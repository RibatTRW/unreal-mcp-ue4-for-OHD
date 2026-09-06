

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

dispatch_main("sequence tool")
