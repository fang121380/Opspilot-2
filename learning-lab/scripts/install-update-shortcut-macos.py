#!/usr/bin/env python3
"""Create a checkout-specific desktop app without hardcoding a developer's path."""

import argparse
import json
import shlex
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lan", action="store_true", help="Keep the LAN sharing mode enabled")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("This installer is for macOS only.")
    script = Path(__file__).resolve().with_name("update-workbench-macos.sh")
    target = Path.home() / "Desktop" / "Opspilot 更新并打开.app"
    if target.exists():
        parser.error(f"Desktop app already exists: {target}")
    command = shlex.join(["/bin/bash", str(script)] + (["--lan"] if args.lan else []))
    # AppleScript receives a string literal as an argv value, never interpolated shell code.
    source = (
        'tell application "Terminal"\nactivate\n'
        f"do script {json.dumps(command, ensure_ascii=False)}\nend tell"
    )
    subprocess.run(["osacompile", "-o", str(target), "-e", source], check=True, timeout=30)
    print(f"Desktop app created: {target}")


if __name__ == "__main__":
    main()
