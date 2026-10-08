package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

const maxRecordBytes = 4 << 20

// Store is intentionally single-process. Atomic rename makes each complete
// session, including retry receipts, one transaction. Run one API instance
// per data directory; multiple replicas require a transactional database.
type Store struct {
	dir         string
	mu          sync.Mutex
	createMu    sync.Mutex
	locks       map[string]*sync.Mutex
	maxSessions int
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	info, err := os.Lstat(dir)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return nil, fmt.Errorf("data directory must be a real directory")
	}
	if err := os.Chmod(dir, 0700); err != nil {
		return nil, err
	}
	return &Store{dir: dir, locks: make(map[string]*sync.Mutex), maxSessions: 10000}, nil
}

func (s *Store) Create(record Record) error {
	s.createMu.Lock()
	defer s.createMu.Unlock()
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		return err
	}
	count := 0
	for _, entry := range entries {
		if filepath.Ext(entry.Name()) == ".json" {
			count++
		}
	}
	if count >= s.maxSessions {
		return failure(503, "session_capacity", "此站点的存档空间暂时已满，请在维护者扩容后再试。", true)
	}
	if _, err := os.Lstat(filepath.Join(s.dir, record.Session.ID+".json")); !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("cannot create unique session")
	}
	return s.Write(record)
}

func randomID() (string, error) {
	var data [32]byte
	if _, err := rand.Read(data[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(data[:]), nil
}

func (s *Store) acquire(id string) (func(), error) {
	if !sessionIDPattern.MatchString(id) {
		return nil, failure(404, "session_not_found", "没有找到这一夜的记录。", false)
	}
	// Do not allocate locks for unknown capabilities.
	if _, err := os.Lstat(filepath.Join(s.dir, id+".json")); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, failure(404, "session_not_found", "没有找到这一夜的记录。", false)
		}
		return nil, err
	}
	s.mu.Lock()
	lock := s.locks[id]
	if lock == nil {
		lock = &sync.Mutex{}
		s.locks[id] = lock
	}
	s.mu.Unlock()
	if !lock.TryLock() {
		return nil, failure(409, "turn_in_progress", "她还在听上一句话，请稍等。", true)
	}
	return lock.Unlock, nil
}

func (s *Store) Read(id string) (Record, error) {
	if !sessionIDPattern.MatchString(id) {
		return Record{}, failure(404, "session_not_found", "没有找到这一夜的记录。", false)
	}
	path := filepath.Join(s.dir, id+".json")
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return Record{}, failure(404, "session_not_found", "没有找到这一夜的记录。", false)
	}
	if err != nil {
		return Record{}, err
	}
	if !info.Mode().IsRegular() || info.Size() > maxRecordBytes {
		return Record{}, fmt.Errorf("invalid record file")
	}
	file, err := os.Open(path)
	if err != nil {
		return Record{}, err
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, maxRecordBytes+1))
	decoder.DisallowUnknownFields()
	var record Record
	if err := decoder.Decode(&record); err != nil {
		return Record{}, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return Record{}, fmt.Errorf("trailing record data")
	}
	if err := validateRecord(record, id); err != nil {
		return Record{}, err
	}
	return record, nil
}

func (s *Store) Write(record Record) error {
	if err := validateRecord(record, record.Session.ID); err != nil {
		return err
	}
	data, err := json.Marshal(record)
	if err != nil || len(data) > maxRecordBytes {
		return fmt.Errorf("session cannot be encoded")
	}
	file, err := os.CreateTemp(s.dir, ".pending-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	defer file.Close()
	if _, err := file.Write(data); err != nil {
		return err
	}
	if err := file.Sync(); err != nil {
		return err
	}
	if err := file.Close(); err != nil {
		return err
	}
	if err := os.Rename(name, filepath.Join(s.dir, record.Session.ID+".json")); err != nil {
		return err
	}
	directory, err := os.Open(s.dir)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}
