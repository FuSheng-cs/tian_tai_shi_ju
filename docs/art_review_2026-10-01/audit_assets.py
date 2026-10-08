"""Read-only repository art inventory; writes review artifacts beside this script.

Run from the repository root: python docs/art_review_2026-10-01/audit_assets.py
No assets are modified or deleted. Git refs are local snapshots, not fetched.
"""
from pathlib import Path
from collections import defaultdict
import base64
import csv
import hashlib
import html
import io
import json
import re
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
PREFIX = 'legacy_vue/public/assets/images/'
EXTENSIONS = {'.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.avif', '.psd', '.aseprite'}


def git(*args, binary=False):
    data = subprocess.check_output(['git', '-C', str(ROOT), *args])
    return data if binary else data.decode('utf-8')


def tree(ref):
    result = {}
    for line in git('ls-tree', '-rl', ref).splitlines():
        meta, name = line.split('\t', 1)
        mode, kind, oid, size = meta.split()
        if kind == 'blob' and Path(name).suffix.lower() in EXTENSIONS and not name.startswith('docs/art_review_2026-10-01/'):
            result[name] = {'blob': oid, 'bytes': int(size)}
    return result


def sources(ref):
    result = {}
    names = git('ls-tree', '-r', '--name-only', ref).splitlines()
    for name in names:
        if (name.startswith('legacy_vue/src/') or name.startswith('legacy_vue/scripts/')
                or name in {'legacy_vue/index.html', 'legacy_vue/vite.config.ts'}) and Path(name).suffix in {'.ts', '.vue', '.css', '.scss', '.html', '.js', '.mjs'}:
            result[name] = git('show', f'{ref}:{name}')
    return result


def references(texts, paths):
    hits = defaultdict(list)
    urls = {'/' + p.removeprefix('legacy_vue/public/'): p for p in paths}
    for filename, text in texts.items():
        constants = dict(re.findall(r"const\s+(\w+)\s*=\s*['\"](/assets/images/[^'\"]+)['\"]", text))
        for line_no, line in enumerate(text.splitlines(), 1):
            resolved = line
            for key, value in constants.items():
                resolved = resolved.replace('${' + key + '}', value)
            for url, path in urls.items():
                if re.search(re.escape(url) + r"(?=['\"`\s)])", resolved):
                    hits[path].append(f'{filename}:{line_no}')
    return hits


def csv_write(name, rows, fields):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        for row in rows:
            writer.writerow({k: '; '.join(v) if isinstance(v, list) else v for k, v in row.items()})


def group(path):
    relative = path.removeprefix(PREFIX)
    if not path.startswith(PREFIX):
        return '文档预览 / 截图 / 其他图形'
    if relative.startswith('safe_exit_'):
        return '09月安全离开'
    if relative.startswith('review_candidates_'):
        return '06月候选与设定'
    if relative.startswith('unified_image2_'):
        if '/game_cg/' in relative:
            return '07月统一游戏CG'
        return '07月统一候选 / 封面 / PV'
    if relative.startswith('pv_cover_candidates/'):
        return 'PV封面候选'
    if relative.startswith(('cg_', 'char_')):
        return '根目录旧CG与人物'
    return '菜单 / 背景 / UI / 特效'


def batch(row):
    p = row['path']
    if row['master_runtime'] or row['shumei_runtime']:
        return 'KEEP', '至少一个版本仍在引用；不进入删除候选'
    rel = p.removeprefix(PREFIX)
    if p.startswith(PREFIX) and rel.startswith(('cg_', 'char_')):
        return 'A', '根目录旧CG/人物已被07月统一资源接替；需同步停用旧生成项'
    if '/review_candidates_2026-06-29/' in p:
        return 'B', '06月历史候选/设定；仅建议移出运行资源，原稿先归档'
    if 'safe_exit_20260918/03-leave-together' in p:
        return 'C', '两人离开候选；实际使用03-leave-ai-only；先归档原稿'
    if p.startswith(PREFIX) and Path(p).name in {'review_contact_sheet.png', 'review_cinematics.png', 'review_gameplay_states.png'}:
        return 'D', '审查拼图在public内重复发布；需调整拼图生成输出目录'
    if rel == 'ui_cigarette_chance_source.png':
        return 'HOLD', 'master仍使用香烟机会图，保留其原稿；数媒版不使用'
    if p.startswith(PREFIX) and rel.startswith('menu_home_'):
        return 'F', '旧首页吸烟背景/菜单光效/标题雾层，均未发现两分支运行引用；原稿先归档'
    if p.startswith(PREFIX) and rel.startswith(('icon_', 'ui_btn_', 'ui_progress_', 'vfx_snow_', 'vfx_flame_', 'bg_rainy_street_')):
        return 'E', '旧占位UI/特效/背景，未发现两分支运行引用；逐项审批'
    return 'HOLD', '原稿/营销/复现依赖/其他文档，保留或人工进一步确认'


def visual_note(path):
    name = Path(path).name
    if name in {'cg_death_falling_16_9.webp', 'cg_death_falling_9_16.webp', 'cg_acquaintance_9_16.webp'}:
        return '明显不合格：彩色抽象占位，缺少像素人物/天台，与统一体系冲突'
    if name.startswith(('bg_rooftop_night_', 'bg_rainy_street_')):
        return '彩色几何占位背景；rooftop仍在成就页使用，必须先替换引用再删除'
    if name.startswith(('char_girl_normal', 'char_girl_sad', 'char_girl_sneer')):
        return '旧坐栏杆/烟雾构图；normal与sad三种规格逐一完全重复；部分图有右下星形标记'
    if name in {'cg_emotion_surprise_16_9.webp', 'cg_emotion_soft_16_9.webp', 'cg_emotion_curiosity_16_9.webp'}:
        return '旧情绪图眼睛/脸型或微笑漂移、烟雾明显；已由统一emotion图替代'
    if name.startswith('cg_end_fall'):
        return '旧结局含实际坠落图/危险姿态；png静帧与同名webp并非全部同画面，不可按扩展名推断'
    if name.startswith('menu_home_bg_'):
        return '旧首页含吸烟人物；现首页为无人天台，功能重合但并非完全相同'
    if '/safe_exit_' in path:
        return '统一黑白短发/服装/天台；落泪抹泪采用近景，离开改为背影；两种离开构图为候选差异'
    if '/game_cg/' in path and name.startswith(('state_', 'emotion_', 'opening_05', 'avatar_')):
        return '统一母版保留；数媒设定已改为大学生/手机，旧相机等道具需另行局部复核，不能直接删除活跃图'
    return '见缩略图与历史审查；未引用或同用途不等于质量不合格'


def thumb(data, size=(360, 203)):
    with Image.open(io.BytesIO(data)) as im:
        rgba = ImageOps.contain(im.convert('RGBA'), size)
        canvas = Image.new('RGB', size, '#191c21')
        canvas.paste(rgba, ((size[0]-rgba.width)//2, (size[1]-rgba.height)//2), rgba)
        return canvas


def main():
    if (OUT / 'cleanup_result.json').exists():
        raise SystemExit('Cleanup has an execution record. Preserve this original review; create a new review directory for a new inventory.')
    OUT.mkdir(exist_ok=True)
    refs = {'master': 'master', 'shumei': 'origin/shumei-merge'}
    trees = {key: tree(ref) for key, ref in refs.items()}
    commits = {key: git('rev-parse', ref).strip() for key, ref in refs.items()}
    runtime = {}
    script_hits = {}
    for key, ref in refs.items():
        text = sources(ref)
        runtime[key] = references({p: t for p, t in text.items() if '/scripts/' not in p}, trees[key])
        scripts = {p: t for p, t in text.items() if '/scripts/' in p}
        script_hits[key] = {p: [f for f, t in scripts.items() if Path(p).name in t] for p in trees[key]}
    all_paths = sorted(set(trees['master']) | set(trees['shumei']) |
                       {p.relative_to(ROOT).as_posix() for p in (ROOT / PREFIX).rglob('*') if p.suffix.lower() in EXTENSIONS})
    rows = []
    data_cache = {}
    thumbnails = {}
    for i, path in enumerate(all_paths, 1):
        local = ROOT / path
        source = 'working-tree' if local.is_file() else 'master'
        data = local.read_bytes() if local.is_file() else git('show', 'master:' + path, binary=True)
        row = {'id': f'ART-{i:03}', 'path': path, 'group': group(path), 'bytes': len(data),
               'sha256': hashlib.sha256(data).hexdigest(), 'master': path in trees['master'],
               'shumei': path in trees['shumei'], 'working_tree': local.is_file(), 'data_source': source,
               'master_runtime': runtime['master'].get(path, []),
               'shumei_runtime': runtime['shumei'].get(path, []),
               'master_scripts': script_hits['master'].get(path, []),
               'shumei_scripts': script_hits['shumei'].get(path, []),
               'width': '', 'height': '', 'pixel_sha256': '', 'decode_error': ''}
        try:
            if Path(path).suffix.lower() != '.svg':
                with Image.open(io.BytesIO(data)) as im:
                    im.load()
                    row['width'], row['height'] = im.size
                    rgba = im.convert('RGBA')
                    row['pixel_sha256'] = hashlib.sha256(str(im.size).encode() + rgba.tobytes()).hexdigest()
                thumbnails[path] = thumb(data)
        except Exception as error:
            row['decode_error'] = str(error)
        row['batch'], row['recommendation'] = batch(row)
        row['visual_note'] = visual_note(path)
        rows.append(row)
        data_cache[path] = data
    byte_groups, pixel_groups = defaultdict(list), defaultdict(list)
    for row in rows:
        byte_groups[row['sha256']].append(row['path'])
        if row['pixel_sha256']:
            pixel_groups[row['pixel_sha256']].append(row['path'])
    duplicates = {'byte_identical': [v for v in byte_groups.values() if len(v) > 1],
                  'decoded_pixel_identical': [v for v in pixel_groups.values() if len(v) > 1]}
    fields = list(rows[0])
    csv_write('inventory.csv', rows, fields)
    csv_write('master_inventory.csv', [r for r in rows if r['master']], fields)
    csv_write('shumei_inventory.csv', [r for r in rows if r['shumei']], fields)
    csv_write('deletion_candidates.csv', [r for r in rows if r['batch'] in 'ABCDEF'], fields)
    # Record every available branch tip so assets outside the two main snapshots are visible.
    branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin').splitlines()
    extra = []
    for ref in branches:
        for p, meta in tree(ref).items():
            if p not in all_paths:
                extra.append({'ref': ref, 'path': p, **meta})
    csv_write('other_branch_only.csv', extra, ['ref', 'path', 'blob', 'bytes'])
    summary = {'commits': commits, 'head': git('rev-parse', 'HEAD').strip(),
               'counts': {key: sum(r[key] for r in rows) for key in refs},
               'public_images': {key: sum(r[key] and r['path'].startswith(PREFIX) for r in rows) for key in refs},
               'runtime_images': {key: sum(bool(r[f'{key}_runtime']) and r['path'].startswith(PREFIX) for r in rows) for key in refs},
               'batches': {b: {'count': sum(r['batch'] == b for r in rows),
                               'bytes': sum(r['bytes'] for r in rows if r['batch'] == b)} for b in ['A', 'B', 'C', 'D', 'E', 'F', 'KEEP', 'HOLD']},
               'added': [r['path'] for r in rows if r['shumei'] and not r['master']],
               'removed': [r['path'] for r in rows if r['master'] and not r['shumei']],
               'changed': [p for p in trees['master'].keys() & trees['shumei'].keys() if trees['master'][p]['blob'] != trees['shumei'][p]['blob']],
               'duplicates': duplicates, 'other_branch_only_rows': len(extra),
               'decode_errors': [r for r in rows if r['decode_error']]}
    (OUT / 'audit.json').write_text(json.dumps({'summary': summary, 'assets': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'approval_manifest.json').write_text(json.dumps({'status': 'awaiting_user_approval', 'commits': commits,
        'note': '仅为待审批清单，未授权执行；KEEP/HOLD不在候选中。',
        'candidates': [{k: r[k] for k in ['id', 'path', 'sha256', 'bytes', 'batch', 'recommendation', 'visual_note', 'master_scripts', 'shumei_scripts']} for r in rows if r['batch'] in 'ABCDEF']}, ensure_ascii=False, indent=2), encoding='utf-8')
    # Review pages show all art, not just candidates; all thumbnails are embedded for offline use.
    cards = []
    for r in rows:
        image_markup = '<div class="noimage">SVG / 源文件：请查看原文件</div>'
        if Path(r['path']).suffix.lower() == '.svg':
            image_markup = '<img loading="lazy" alt="SVG美术预览" src="data:image/svg+xml;base64,' + base64.b64encode(data_cache[r['path']]).decode() + '">'
        elif r['path'] in thumbnails:
            buf = io.BytesIO()
            thumbnails[r['path']].save(buf, 'JPEG', quality=82)
            image_markup = '<img loading="lazy" src="data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode() + '">'
        eligible = r['batch'] in 'ABCDEF'
        cards.append('<article data-batch="' + r['batch'] + '"><label><input type="checkbox" ' +
                     ('' if eligible else 'disabled ') + 'data-id="' + r['id'] + '"> ' + r['id'] + ' · ' + r['batch'] +
                     '</label>' + image_markup + '<b>' + html.escape(Path(r['path']).name) + '</b><p>' +
                     html.escape(r['path']) + '</p><p>' + html.escape(r['group']) + ' · ' + str(r['width']) + '×' + str(r['height']) +
                     ' · ' + f'{r["bytes"]/1024:.0f} KiB' + '</p><p>master运行引用 ' + str(len(r['master_runtime'])) +
                     ' / 数媒运行引用 ' + str(len(r['shumei_runtime'])) + '</p><p>' + html.escape(r['recommendation']) + '</p><p>' + html.escape(r['visual_note']) + '</p></article>')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CG资源审批盘点</title>
<style>[hidden]{display:none!important}body{background:#11151b;color:#e2e7ef;font:15px/1.6 system-ui;margin:24px}header{position:sticky;top:0;background:#11151bf5;padding:12px;z-index:1}button,select{padding:8px;margin:4px;background:#25303f;color:white;border:1px solid #65738a;border-radius:5px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px}article{background:#1c232e;border:1px solid #3d4657;padding:12px;border-radius:8px}img{width:100%;height:203px;object-fit:contain}b,p{overflow-wrap:anywhere}p{font-size:12px;color:#bac5d7;margin:5px 0}.noimage{height:203px;display:grid;place-items:center}label{display:block;padding-bottom:8px}</style>
<header><h2>《天台十句》全资源盘点 · 2026-10-01</h2><p>当前本地 Git 快照。A旧CG；B06月候选（归档）；C未使用离开候选；D公开审查拼图；E旧UI/背景；F旧首页。KEEP两版至少一版使用；HOLD原稿/营销等。未默认勾选，页面不会删除资源；导出后交由用户确认。</p>
<select id="filter"><option value="all">全部资源</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option>F</option><option>KEEP</option><option>HOLD</option></select><button id="download">导出已选审批JSON</button><span id="count">已选 0</span><label id="export-label" hidden>选择JSON（复制后发送确认；页面不会删除资源）<textarea id="approval-output" readonly aria-label="审批选择JSON" style="width:98%;height:150px;background:#141c28;color:white"></textarea></label></header><main class="grid">''' + ''.join(cards) + '''</main><script>
document.querySelector('#filter').onchange=e=>document.querySelectorAll('article').forEach(x=>x.hidden=e.target.value!=='all'&&x.dataset.batch!==e.target.value);
document.onchange=()=>document.querySelector('#count').textContent='已选 '+document.querySelectorAll('input:checked').length;
document.querySelector('#download').onclick=()=>{const ids=[...document.querySelectorAll('input:checked')].map(x=>x.dataset.id);document.querySelector('#approval-output').value=JSON.stringify({status:'user_selection_requires_confirmation',ids},null,2);document.querySelector('#export-label').hidden=false};
</script></html>'''
    (OUT / 'review.html').write_text(page, encoding='utf-8')
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 16)
    # One sheet per category, display every raster file, including responsive variants and raw originals.
    for category_no, category in enumerate(dict.fromkeys(r['group'] for r in rows), 1):
        items = [r for r in rows if r['group'] == category and r['path'] in thumbnails]
        for page_no, start in enumerate(range(0, len(items), 24), 1):
            chunk = items[start:start+24]
            sheet = Image.new('RGB', (4*380, ((len(chunk)+3)//4)*262+45), '#11151b')
            draw = ImageDraw.Draw(sheet)
            draw.text((12, 8), category + ' · ' + str(page_no), font=font, fill='white')
            for index, row in enumerate(chunk):
                x, y = (index % 4)*380+10, (index//4)*262+45
                sheet.paste(thumbnails[row['path']], (x, y))
                label = row['id'] + ' / ' + row['batch'] + ' / ' + Path(row['path']).name
                while draw.textlength(label, font=font) > 356:
                    label = label[:-2] + '…'
                draw.text((x, y+206), label, font=font, fill='white')
                draw.text((x, y+229), f"{row['width']}×{row['height']}  M:{bool(row['master_runtime'])} S:{bool(row['shumei_runtime'])}", font=font, fill='#abbad2')
            sheet.save(OUT / f'contact_{category_no:02}_{page_no:02}.jpg', quality=88)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
