Task 10 README apex-only update evidence
Date: 2026-03-01

Updated file:
- README.md

Validation results:
- grep 'developer\|researcher\|creative' README.md -> no output
- grep -c 'install' README.md -> 7
- grep -c '\-\-clean' README.md -> 2

Checklist:
- Basic Workflow uses apex for diff/apply and includes install shortcut.
- list example output shows only apex builtin preset.
- apply flags include --clean.
- install command section added with --dry-run, --no-backup, --clean.
- Built-in Presets table contains exactly one row: apex.
- Architecture command list includes install.
