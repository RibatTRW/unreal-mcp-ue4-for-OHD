import json


def execute_console_command(command):
    normalized_command = str(command or "").strip()
    if not normalized_command:
        return {"success": False, "message": "command is required"}

    unreal.SystemLibrary.execute_console_command(None, normalized_command)
    return {
        "success": True,
        "command": normalized_command,
        "output_captured": False,
        "note": "Unreal console command output is not captured by this tool. Use manage_editor.run_python when Python stdout is required.",
    }


def main():
    command = decode_template_json("""${command}""")
    print(json.dumps(execute_console_command(command), indent=2))


if __name__ == "__main__":
    main()
