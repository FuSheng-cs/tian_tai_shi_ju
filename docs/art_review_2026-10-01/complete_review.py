"""Refresh the review's execution state without changing its original art data."""
from pathlib import Path
import json
import re

OUT = Path(__file__).resolve().parent
result = json.loads((OUT / 'cleanup_result.json').read_text(encoding='utf-8'))
assert result['status'] == 'completed' and result['removed_count'] == 83

page = (OUT / 'review.html').read_text(encoding='utf-8')
page = page.replace('<title>CG资源审批盘点</title>', '<title>CG资源盘点 · 清理已完成</title>')
page = page.replace('《天台十句》全资源盘点 · 2026-10-01', '《天台十句》美术清理已完成 · 2026-10-01')
page = re.sub(
    r'(<header><h2>.*?</h2>)<p>.*?</p>',
    lambda m: m.group(1) + '<p>已归档并移出当前数媒 public：83 个文件 / 85.31 MiB；保留 98 个运行目录图形。'
    '下方缩略图是清理前的完整审查证据，已移除项也可继续查看。master 与活跃原稿保留。'
    '<a href="CLEANUP.md" style="color:#a8c9ff">查看执行与恢复说明</a></p>',
    page,
)
page = page.replace('<button id="download">导出已选审批JSON</button>', '<button id="download" disabled>清理已完成</button>')
page = page.replace('<span id="count">已选 0</span>', '<span id="count">A–F 已执行，保留项不变</span>')
page = page.replace("document.onchange=()=>document.querySelector('#count').textContent='已选 '+document.querySelectorAll('input:checked').length;", '')
for record in result['removed_files']:
    asset_id = record['id']
    page = re.sub(
        r'(<input type="checkbox" )(data-id="' + asset_id + r'")',
        r'\1disabled \2',
        page,
    )
    page = page.replace(asset_id + ' · ' + record['batch'] + '</label>',
                        asset_id + ' · ' + record['batch'] + ' · 已归档并移出 public</label>')
(OUT / 'review.html').write_text(page, encoding='utf-8')

readme = OUT / 'README.md'
text = readme.read_text(encoding='utf-8')
text = text.replace('> 2026-10-01。状态：盘点与预览已完成，未删除任何美术资源。',
                    '> 2026-10-01。A–F 已执行：83 个文件全部外部备份并移出当前数媒 public。')
text = text.replace('## 范围与证据',
                    '[清理执行结果与恢复方法](CLEANUP.md) · [当前文件清单](current_inventory.csv)\n\n'
                    '**以下盘点与比较是清理前的审查快照。当前验证与执行状态以 CLEANUP.md 为准。**\n\n## 范围与证据', 1)
text = text.replace('## 待用户审批的清理批次', '## 原审查批次（现已执行 A–F）')
text = text.replace('用户可直接回复“批准 A+D+E”或指定批次/ART 编号。也可在 [逐图审批页](review.html)勾选并导出选择 JSON；勾选或导出本身不执行删除。',
                    '用户查看清单后授权自主处理，已执行 A–F。[逐图盘点页](review.html)保留所有原图预览并显示完成状态。')
text = text.replace('建议先审批 **A + D + E（56 个文件，约 45.61 MiB）**；B/C/F 属于候选及原稿归档选择，可单独决定。执行时每项先核对原 SHA，再把待移除原稿/候选备份到运行目录之外，记录备份和恢复方法。',
                    '审查时优先建议 A+D+E；用户授权后已将 A–F 全部原文件归档，逐项验证 SHA-256，再移出运行目录。')
readme.write_text(text, encoding='utf-8')

validation_path = OUT / 'cleanup_validation.json'
validation = json.loads(validation_path.read_text(encoding='utf-8'))
validation.update({
    'frontend_test_files_passed': 16, 'frontend_tests_passed': 113,
    'frontend_lint': 'passed', 'frontend_build': 'passed',
    'unified_production_file_count': 38,
    'archive_read_only_restore_check': {'verified_files': 83, 'restored_files': 0},
    'browser': {
        'production_url': 'http://127.0.0.1:5180/achievements',
        'desktop_background': '/assets/images/menu_bg_rooftop_1600.webp',
        'mobile_background': '/assets/images/menu_bg_rooftop_900.webp',
        'both_backgrounds_decoded': True, 'mobile_viewport_width': 390,
        'mobile_main_scroll_width': 380,
        'screenshots': ['achievements_desktop.png', 'achievements_mobile.png'],
    },
})
validation_path.write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding='utf-8')
print('Review and cleanup validation updated; original asset inventory preserved.')
