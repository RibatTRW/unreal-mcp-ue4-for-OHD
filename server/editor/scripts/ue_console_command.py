import json


# Session-teardown commands must never run through this bare-context
# path: execute_console_command(None, "quit") hard-crashes this editor
# build (Assertion failed: InWorld, run 17). End sessions with
# manage_editor stop_pie instead.
_SESSION_ENDING_COMMANDS = frozenset(["quit", "exit", "disconnect"])


def execute_console_command(command):
    normalized_command = unreal_text(command or "").strip()
    if not normalized_command:
        return {"success": False, "message": "command is required"}

    if normalized_command.lower() in _SESSION_ENDING_COMMANDS:
        return {
            "success": False,
            "message": (
                "Refusing '{0}': session-ending console commands crash this "
                "editor build when sent without a world context. Use "
                "manage_editor stop_pie to end a PIE session.".format(
                    normalized_command
                ),
            ),
        }

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
