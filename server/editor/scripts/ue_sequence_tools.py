import json


OPERATIONS = {
    "sequence_support": sequence_support_status,
    "inspect_sequence": inspect_sequence,
    "set_playback_range": set_playback_range,
    "convert_time": convert_sequence_time,
    "bind_actor": bind_actor,
    "add_track": add_track,
    "add_section": add_section,
    "add_key": add_key,
    "add_camera_cut": add_camera_cut,
    "analyze_playback_speed": analyze_playback_speed,
    "calculate_playback_time": calculate_playback_time,
}


def main():
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown sequence tool operation: {0}".format(operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": str(exc)}

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
