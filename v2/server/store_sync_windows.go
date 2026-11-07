package main

// Windows does not support os.File.Sync on directories. The record file is
// flushed before rename; directory fsync remains enabled on the Linux host.
func syncDirectory(string) error { return nil }
