import math


TRACK_CLASS_ALIASES = {
    "transform": "MovieScene3DTransformTrack",
    "3dtransform": "MovieScene3DTransformTrack",
    "3d_transform": "MovieScene3DTransformTrack",
    "float": "MovieSceneFloatTrack",
    "bool": "MovieSceneBoolTrack",
    "boolean": "MovieSceneBoolTrack",
    "integer": "MovieSceneIntegerTrack",
    "int": "MovieSceneIntegerTrack",
    "byte": "MovieSceneByteTrack",
    "string": "MovieSceneStringTrack",
    "visibility": "MovieSceneVisibilityTrack",
    "camera_cut": "MovieSceneCameraCutTrack",
    "cameracut": "MovieSceneCameraCutTrack",
    "camera": "MovieSceneCameraCutTrack",
    "slomo": "MovieSceneSlomoTrack",
    "slowmo": "MovieSceneSlomoTrack",
    "time_dilation": "MovieSceneSlomoTrack",
    "timedilation": "MovieSceneSlomoTrack",
    "audio": "MovieSceneAudioTrack",
    "skeletal_animation": "MovieSceneSkeletalAnimationTrack",
    "skeletalanimation": "MovieSceneSkeletalAnimationTrack",
    "animation": "MovieSceneSkeletalAnimationTrack",
    "sub": "MovieSceneSubTrack",
    "subsequence": "MovieSceneSubTrack",
    "cinematic_shot": "MovieSceneCinematicShotTrack",
    "cinematicshot": "MovieSceneCinematicShotTrack",
    "material_parameter_collection": "MovieSceneMaterialParameterCollectionTrack",
    "mpc": "MovieSceneMaterialParameterCollectionTrack",
}


CHANNEL_CLASS_ALIASES = {
    "float": "MovieSceneScriptingFloatChannel",
    "bool": "MovieSceneScriptingBoolChannel",
    "boolean": "MovieSceneScriptingBoolChannel",
    "integer": "MovieSceneScriptingIntegerChannel",
    "int": "MovieSceneScriptingIntegerChannel",
    "byte": "MovieSceneScriptingByteChannel",
    "string": "MovieSceneScriptingStringChannel",
    "object": "MovieSceneScriptingObjectPathChannel",
    "object_path": "MovieSceneScriptingObjectPathChannel",
    "actor_reference": "MovieSceneScriptingActorReferenceChannel",
    "actor": "MovieSceneScriptingActorReferenceChannel",
}


def _clean_identifier(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def sequence_support_status(args=None):
    required_classes = [
        "LevelSequence",
        "MovieSceneTrack",
        "MovieSceneCameraCutTrack",
        "MovieSceneScriptingFloatChannel",
        "SequenceTimeUnit",
    ]
    optional_classes = [
        "LevelSequenceFactoryNew",
        "MovieScene3DTransformTrack",
        "MovieSceneFloatTrack",
        "MovieSceneBoolTrack",
        "MovieSceneSlomoTrack",
    ]
    missing_required = [name for name in required_classes if not hasattr(unreal, name)]
    missing_optional = [name for name in optional_classes if not hasattr(unreal, name)]
    return {
        "success": True,
        "available": len(missing_required) == 0,
        "required_classes": {
            name: bool(hasattr(unreal, name)) for name in required_classes
        },
        "optional_classes": {
            name: bool(hasattr(unreal, name)) for name in optional_classes
        },
        "missing_required": missing_required,
        "missing_optional": missing_optional,
        "message": "Sequencer scripting is available."
        if not missing_required
        else "Enable the SequencerScripting plugin in the UE4.27 project to use advanced manage_sequence actions.",
    }


def require_sequence_scripting():
    status = sequence_support_status()
    if not status["available"]:
        raise RuntimeError(status["message"])


def load_level_sequence(identifier):
    require_sequence_scripting()
    return load_asset_by_identifier(identifier, ["LevelSequence"])


def sequence_identifier_from_args(args):
    for key in ("sequence_path", "asset_path", "path", "name"):
        value = args.get(key)
        if value:
            return value
    raise ValueError("sequence_path, asset_path, path, or name is required")


def load_sequence_from_args(args):
    return load_level_sequence(sequence_identifier_from_args(args))


def text_to_string(value):
    if value is None:
        return ""
    try:
        if hasattr(value, "to_string"):
            return str(value.to_string())
    except Exception:
        pass
    return str(value)


def object_path(value):
    try:
        return value.get_path_name()
    except Exception:
        return ""


def guid_to_string(guid):
    if guid is None:
        return ""
    for method_name in ("to_string", "ToString"):
        try:
            method = getattr(guid, method_name, None)
            if method:
                return str(method())
        except Exception:
            pass
    return str(guid)


def normalize_guid(value):
    return re.sub(r"[^a-f0-9]", "", str(value or "").lower())


def frame_number_value(value):
    try:
        return int(value.value)
    except Exception:
        try:
            return int(value)
        except Exception:
            return 0


def frame_time_to_dict(frame_time):
    frame_number = getattr(frame_time, "frame_number", frame_time)
    return {
        "frame": frame_number_value(frame_number),
        "sub_frame": float(getattr(frame_time, "sub_frame", 0.0) or 0.0),
    }


def frame_rate_to_dict(rate):
    numerator = 0
    denominator = 1
    for key in ("numerator", "Numerator"):
        try:
            numerator = int(getattr(rate, key))
            break
        except Exception:
            pass
    for key in ("denominator", "Denominator"):
        try:
            denominator = int(getattr(rate, key))
            break
        except Exception:
            pass
    if denominator == 0:
        denominator = 1
    return {
        "numerator": numerator,
        "denominator": denominator,
        "fps": float(numerator) / float(denominator),
    }


def frame_rate_decimal(rate):
    info = frame_rate_to_dict(rate)
    return info["fps"] or 1.0


def seconds_to_frame(seconds, rate):
    return int(round(float(seconds) * frame_rate_decimal(rate)))


def frame_to_seconds(frame, rate):
    return float(frame) / frame_rate_decimal(rate)


def get_display_rate(sequence):
    return sequence.get_display_rate()


def get_tick_resolution(sequence):
    return sequence.get_tick_resolution()


def time_unit_enum(time_unit):
    value = str(time_unit or "display_rate").lower()
    sequence_time_unit = getattr(unreal, "SequenceTimeUnit", None)
    if sequence_time_unit and "tick" in value:
        return sequence_time_unit.TICK_RESOLUTION
    if sequence_time_unit:
        return sequence_time_unit.DISPLAY_RATE
    return None


def frame_number_for_time(sequence, args, default_key="frame"):
    unit_value = str(args.get("time_unit") or "display_rate").lower()
    if args.get("time_seconds") is not None:
        rate = get_tick_resolution(sequence) if "tick" in unit_value else get_display_rate(sequence)
        return unreal.FrameNumber(seconds_to_frame(float(args.get("time_seconds")), rate))
    if args.get("seconds") is not None:
        rate = get_tick_resolution(sequence) if "tick" in unit_value else get_display_rate(sequence)
        return unreal.FrameNumber(seconds_to_frame(float(args.get("seconds")), rate))
    if args.get(default_key) is None:
        raise ValueError("{0}, time_seconds, or seconds is required".format(default_key))
    return unreal.FrameNumber(int(args.get(default_key)))


def seconds_from_args(sequence, args, frame_key="frame", seconds_key="seconds"):
    if args.get(seconds_key) is not None:
        return float(args.get(seconds_key))
    if args.get("time_seconds") is not None:
        return float(args.get("time_seconds"))
    if args.get(frame_key) is not None:
        return frame_to_seconds(int(args.get(frame_key)), get_display_rate(sequence))
    raise ValueError("{0}, {1}, or time_seconds is required".format(frame_key, seconds_key))


def resolve_track_class(track_type):
    if not track_type:
        raise ValueError("track_type is required")

    if not isinstance(track_type, str):
        return track_type

    candidates = []
    raw = str(track_type).strip()
    cleaned = _clean_identifier(raw)
    alias = TRACK_CLASS_ALIASES.get(raw.lower()) or TRACK_CLASS_ALIASES.get(cleaned)
    if alias:
        candidates.append(alias)
    candidates.extend(
        [
            raw,
            raw[0:1].upper() + raw[1:],
            "MovieScene{0}Track".format(raw[0:1].upper() + raw[1:]),
        ]
    )

    for candidate in candidates:
        try:
            resolved = getattr(unreal, candidate, None)
            if resolved:
                return resolved
        except Exception:
            continue

    raise ValueError("Unsupported or unavailable Sequencer track type: {0}".format(track_type))


def resolve_channel_class(channel_type):
    if not channel_type:
        return None

    raw = str(channel_type).strip()
    cleaned = _clean_identifier(raw)
    candidates = []
    alias = CHANNEL_CLASS_ALIASES.get(raw.lower()) or CHANNEL_CLASS_ALIASES.get(cleaned)
    if alias:
        candidates.append(alias)
    candidates.extend([raw, "MovieSceneScripting{0}Channel".format(raw[0:1].upper() + raw[1:])])

    for candidate in candidates:
        try:
            resolved = getattr(unreal, candidate, None)
            if resolved:
                return resolved
        except Exception:
            continue

    raise ValueError("Unsupported or unavailable Sequencer channel type: {0}".format(channel_type))


def class_name(value):
    return get_object_class_name(value)


def section_has_start(section):
    try:
        return bool(section.has_start_frame())
    except Exception:
        return True


def section_has_end(section):
    try:
        return bool(section.has_end_frame())
    except Exception:
        return True


def section_start_frame(section):
    try:
        return int(section.get_start_frame())
    except Exception:
        return None


def section_end_frame(section):
    try:
        return int(section.get_end_frame())
    except Exception:
        return None


def section_start_seconds(section):
    try:
        return float(section.get_start_frame_seconds())
    except Exception:
        start = section_start_frame(section)
        return None if start is None else float(start)


def section_end_seconds(section):
    try:
        return float(section.get_end_frame_seconds())
    except Exception:
        end = section_end_frame(section)
        return None if end is None else float(end)


def set_section_range_from_args(section, args):
    start_seconds = args.get("start_seconds")
    end_seconds = args.get("end_seconds")
    duration_seconds = args.get("duration_seconds")
    start_frame = args.get("start_frame")
    end_frame = args.get("end_frame")
    duration_frames = args.get("duration_frames")

    if start_seconds is not None or end_seconds is not None or duration_seconds is not None:
        start = 0.0 if start_seconds is None else float(start_seconds)
        if end_seconds is not None:
            end = float(end_seconds)
        else:
            end = start + float(1.0 if duration_seconds is None else duration_seconds)
        try:
            section.set_range_seconds(start, end)
        except Exception:
            section.set_start_frame_seconds(start)
            section.set_end_frame_seconds(end)
        return

    if start_frame is not None or end_frame is not None or duration_frames is not None:
        start = 0 if start_frame is None else int(start_frame)
        if end_frame is not None:
            end = int(end_frame)
        else:
            end = start + int(1 if duration_frames is None else duration_frames)
        try:
            section.set_range(start, end)
        except Exception:
            section.set_start_frame(start)
            section.set_end_frame(end)
        return

    if bool(args.get("unbounded", False)):
        try:
            section.set_start_frame_bounded(False)
            section.set_end_frame_bounded(False)
        except Exception:
            pass


def save_sequence_asset(sequence, args):
    if args.get("save") is False:
        return False
    return bool(save_loaded_editor_asset(sequence))


def channel_default(channel):
    for method_name in ("get_default", "GetDefault"):
        try:
            method = getattr(channel, method_name, None)
            if method:
                return json_safe_value(method())
        except Exception:
            pass
    return None


def json_safe_value(value):
    if value is None:
        return None
    if isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (list, tuple)):
        return [json_safe_value(entry) for entry in value]
    if hasattr(value, "get_path_name"):
        return object_path(value)
    return str(value)


def key_summary(sequence, key):
    display_time = None
    tick_time = None
    try:
        display_time = frame_time_to_dict(key.get_time(time_unit_enum("display_rate")))
    except Exception:
        pass
    try:
        tick_time = frame_time_to_dict(key.get_time(time_unit_enum("tick_resolution")))
    except Exception:
        pass
    value = None
    try:
        value = json_safe_value(key.get_value())
    except Exception:
        pass
    result = {"value": value}
    if display_time:
        result["display_time"] = display_time
        result["seconds"] = frame_to_seconds(display_time["frame"], get_display_rate(sequence)) + (
            display_time.get("sub_frame", 0.0) / frame_rate_decimal(get_display_rate(sequence))
        )
    if tick_time:
        result["tick_time"] = tick_time
    for method_name, output_key in (
        ("get_interpolation_mode", "interpolation"),
        ("get_tangent_mode", "tangent_mode"),
        ("get_tangent_weight_mode", "tangent_weight_mode"),
    ):
        try:
            method = getattr(key, method_name, None)
            if method:
                result[output_key] = str(method())
        except Exception:
            pass
    return result


def channel_summary(sequence, channel, include_keys=False, key_limit=20):
    keys = []
    try:
        keys = list(channel.get_keys())
    except Exception:
        keys = []

    result = {
        "name": text_to_string(channel.get_name()) if hasattr(channel, "get_name") else "",
        "class": class_name(channel),
        "key_count": len(keys),
        "default": channel_default(channel),
    }

    if include_keys:
        result["keys"] = [key_summary(sequence, key) for key in keys[: max(0, int(key_limit))]]

    return result


def section_summary(sequence, section, include_channels=False, include_keys=False, key_limit=20):
    result = {
        "name": get_object_name(section),
        "class": class_name(section),
        "has_start": section_has_start(section),
        "start_frame": section_start_frame(section),
        "start_seconds": section_start_seconds(section),
        "has_end": section_has_end(section),
        "end_frame": section_end_frame(section),
        "end_seconds": section_end_seconds(section),
    }

    if include_channels:
        try:
            channels = list(section.get_channels())
        except Exception:
            channels = []
        result["channels"] = [
            channel_summary(sequence, channel, include_keys, key_limit) for channel in channels
        ]

    return result


def track_summary(sequence, track, include_sections=True, include_channels=False, include_keys=False, key_limit=20):
    result = {
        "name": get_object_name(track),
        "display_name": text_to_string(track.get_display_name()) if hasattr(track, "get_display_name") else "",
        "class": class_name(track),
    }
    try:
        result["property_name"] = str(track.get_property_name())
        result["property_path"] = str(track.get_property_path())
    except Exception:
        pass

    if include_sections:
        try:
            sections = list(track.get_sections())
        except Exception:
            sections = []
        result["section_count"] = len(sections)
        result["sections"] = [
            section_summary(sequence, section, include_channels, include_keys, key_limit)
            for section in sections
        ]

    return result


def binding_summary(sequence, binding, include_tracks=True, include_sections=True, include_channels=False, include_keys=False, key_limit=20):
    result = {
        "id": guid_to_string(binding.get_id()) if hasattr(binding, "get_id") else "",
        "name": binding.get_name() if hasattr(binding, "get_name") else "",
        "display_name": text_to_string(binding.get_display_name()) if hasattr(binding, "get_display_name") else "",
        "is_valid": bool(binding.is_valid()) if hasattr(binding, "is_valid") else True,
    }
    try:
        template = binding.get_object_template()
        result["object_template"] = object_path(template)
        result["object_class"] = class_name(template)
    except Exception:
        pass

    if include_tracks:
        try:
            tracks = list(binding.get_tracks())
        except Exception:
            tracks = []
        result["track_count"] = len(tracks)
        result["tracks"] = [
            track_summary(sequence, track, include_sections, include_channels, include_keys, key_limit)
            for track in tracks
        ]

    return result


def inspect_sequence(args):
    sequence = load_sequence_from_args(args)
    include_channels = bool(args.get("include_channels", True))
    include_keys = bool(args.get("include_keys", False))
    key_limit = int(args.get("key_limit") or 20)

    display_rate = get_display_rate(sequence)
    tick_resolution = get_tick_resolution(sequence)
    master_tracks = list(sequence.get_master_tracks())
    bindings = list(sequence.get_bindings())
    playback_start = int(sequence.get_playback_start())
    playback_end = int(sequence.get_playback_end())

    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "name": get_object_name(sequence),
        "class": class_name(sequence),
        "display_rate": frame_rate_to_dict(display_rate),
        "tick_resolution": frame_rate_to_dict(tick_resolution),
        "playback_range": {
            "start_frame": playback_start,
            "end_frame": playback_end,
            "start_seconds": sequence.get_playback_start_seconds(),
            "end_seconds": sequence.get_playback_end_seconds(),
            "duration_frames": playback_end - playback_start,
            "duration_seconds": sequence.get_playback_end_seconds()
            - sequence.get_playback_start_seconds(),
        },
        "master_tracks": [
            track_summary(sequence, track, True, include_channels, include_keys, key_limit)
            for track in master_tracks
        ],
        "bindings": [
            binding_summary(sequence, binding, True, True, include_channels, include_keys, key_limit)
            for binding in bindings
        ],
    }


def set_playback_range(args):
    sequence = load_sequence_from_args(args)
    if args.get("start_seconds") is not None:
        sequence.set_playback_start_seconds(float(args.get("start_seconds")))
    elif args.get("start_frame") is not None:
        sequence.set_playback_start(int(args.get("start_frame")))

    if args.get("end_seconds") is not None:
        sequence.set_playback_end_seconds(float(args.get("end_seconds")))
    elif args.get("end_frame") is not None:
        sequence.set_playback_end(int(args.get("end_frame")))

    saved = save_sequence_asset(sequence, args)
    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "saved": saved,
        "playback_range": inspect_sequence({"asset_path": get_asset_package_name(sequence)})[
            "playback_range"
        ],
    }


def convert_sequence_time(args):
    sequence = load_sequence_from_args(args)
    display_rate = get_display_rate(sequence)
    tick_resolution = get_tick_resolution(sequence)

    if args.get("seconds") is not None:
        seconds = float(args.get("seconds"))
        display_frame = seconds_to_frame(seconds, display_rate)
        tick_frame = seconds_to_frame(seconds, tick_resolution)
    elif args.get("display_frame") is not None:
        display_frame = int(args.get("display_frame"))
        seconds = frame_to_seconds(display_frame, display_rate)
        tick_frame = seconds_to_frame(seconds, tick_resolution)
    elif args.get("tick_frame") is not None:
        tick_frame = int(args.get("tick_frame"))
        seconds = frame_to_seconds(tick_frame, tick_resolution)
        display_frame = seconds_to_frame(seconds, display_rate)
    elif args.get("frame") is not None:
        display_frame = int(args.get("frame"))
        seconds = frame_to_seconds(display_frame, display_rate)
        tick_frame = seconds_to_frame(seconds, tick_resolution)
    else:
        raise ValueError("Provide seconds, display_frame, tick_frame, or frame.")

    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "display_rate": frame_rate_to_dict(display_rate),
        "tick_resolution": frame_rate_to_dict(tick_resolution),
        "seconds": seconds,
        "display_frame": display_frame,
        "tick_frame": tick_frame,
    }


def find_actor_for_sequence(args):
    for key in ("actor_path", "object_path"):
        value = args.get(key)
        if value:
            try:
                loaded = unreal.load_object(None, value)
                if loaded:
                    return loaded
            except Exception:
                pass

    actor_name = args.get("actor_name") or args.get("name")
    if actor_name:
        actor = find_actor_by_name(actor_name)
        if actor:
            return actor

    raise ValueError("actor_name, actor_path, object_path, or name is required")


def binding_matches_object(sequence, binding, target_object):
    world = get_editor_world()
    try:
        objects = sequence.locate_bound_objects(binding, world)
    except Exception:
        objects = []
    target_path = object_path(target_object)
    for bound_object in objects:
        if bound_object == target_object or object_path(bound_object) == target_path:
            return True
    return False


def find_binding_by_args(sequence, args, required=True):
    binding_id = args.get("binding_id")
    binding_name = args.get("binding_name")

    target_actor = None
    if args.get("actor_name") or args.get("actor_path") or args.get("object_path"):
        try:
            target_actor = find_actor_for_sequence(args)
        except Exception:
            target_actor = None

    for binding in sequence.get_bindings():
        if binding_id and normalize_guid(binding.get_id()) == normalize_guid(binding_id):
            return binding
        if binding_name:
            candidate_names = [
                binding.get_name() if hasattr(binding, "get_name") else "",
                text_to_string(binding.get_display_name())
                if hasattr(binding, "get_display_name")
                else "",
            ]
            if str(binding_name).lower() in [name.lower() for name in candidate_names]:
                return binding
        if target_actor and binding_matches_object(sequence, binding, target_actor):
            return binding

    if required:
        raise ValueError("Binding not found. Provide binding_id, binding_name, or an already-bound actor.")
    return None


def bind_actor(args):
    sequence = load_sequence_from_args(args)
    actor = find_actor_for_sequence(args)
    if bool(args.get("reuse_existing", True)):
        existing = find_binding_by_args(sequence, {"object_path": object_path(actor)}, required=False)
        if existing:
            return {
                "success": True,
                "asset_path": get_asset_package_name(sequence),
                "created": False,
                "binding": binding_summary(sequence, existing, include_tracks=False),
            }

    binding = sequence.add_possessable(actor)
    if args.get("binding_name"):
        try:
            binding.set_name(str(args.get("binding_name")))
        except Exception:
            pass
    saved = save_sequence_asset(sequence, args)
    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "created": True,
        "saved": saved,
        "actor": {
            "name": get_object_name(actor),
            "path": object_path(actor),
            "class": class_name(actor),
        },
        "binding": binding_summary(sequence, binding, include_tracks=False),
    }


def track_scope_from_args(args):
    scope = str(args.get("scope") or "").lower()
    if args.get("master") is True or scope == "master":
        return "master"
    if args.get("binding_id") or args.get("binding_name") or args.get("actor_name") or args.get("actor_path"):
        return "binding"
    track_type = str(args.get("track_type") or "").lower()
    if "camera" in track_type or "slomo" in track_type or "shot" in track_type or "sub" in track_type:
        return "master"
    return "binding"


def add_track(args):
    sequence = load_sequence_from_args(args)
    track_class = resolve_track_class(args.get("track_type"))
    scope = track_scope_from_args(args)

    if scope == "master":
        track = sequence.add_master_track(track_class)
        binding = None
    else:
        binding = find_binding_by_args(sequence, args)
        track = binding.add_track(track_class)

    if args.get("display_name") and hasattr(track, "set_display_name"):
        try:
            track.set_display_name(str(args.get("display_name")))
        except Exception:
            pass

    property_name = args.get("property_name")
    property_path = args.get("property_path") or property_name
    if property_name and hasattr(track, "set_property_name_and_path"):
        track.set_property_name_and_path(str(property_name), str(property_path))

    section = None
    if bool(args.get("add_section", False)):
        section = track.add_section()
        set_section_range_from_args(section, args)

    saved = save_sequence_asset(sequence, args)
    result = {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "saved": saved,
        "scope": scope,
        "track": track_summary(sequence, track, include_sections=True, include_channels=False),
    }
    if binding:
        result["binding"] = binding_summary(sequence, binding, include_tracks=False)
    if section:
        result["section"] = section_summary(sequence, section)
    return result


def candidate_tracks_for_args(sequence, args):
    scope = track_scope_from_args(args)
    if scope == "master":
        tracks = list(sequence.get_master_tracks())
    else:
        binding = find_binding_by_args(sequence, args)
        tracks = list(binding.get_tracks())

    if args.get("track_type"):
        track_class = resolve_track_class(args.get("track_type"))
        tracks = [track for track in tracks if class_is_child_of(track.get_class(), track_class)]

    if args.get("track_name"):
        needle = str(args.get("track_name")).lower()
        filtered = []
        for track in tracks:
            names = [
                get_object_name(track),
                text_to_string(track.get_display_name()) if hasattr(track, "get_display_name") else "",
            ]
            if any(needle == name.lower() for name in names):
                filtered.append(track)
        tracks = filtered

    return tracks


def find_track_by_args(sequence, args):
    tracks = candidate_tracks_for_args(sequence, args)
    if not tracks:
        raise ValueError("Track not found.")
    track_index = int(args.get("track_index") or 0)
    if track_index < 0 or track_index >= len(tracks):
        raise ValueError("track_index {0} is out of range.".format(track_index))
    return tracks[track_index]


def add_section(args):
    sequence = load_sequence_from_args(args)
    track = find_track_by_args(sequence, args)
    section = track.add_section()
    set_section_range_from_args(section, args)
    saved = save_sequence_asset(sequence, args)
    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "saved": saved,
        "track": track_summary(sequence, track, include_sections=False),
        "section": section_summary(sequence, section, include_channels=True),
    }


def find_section_by_args(track, args):
    sections = list(track.get_sections())
    if not sections:
        raise ValueError("Track has no sections.")
    section_index = int(args.get("section_index") or 0)
    if section_index < 0 or section_index >= len(sections):
        raise ValueError("section_index {0} is out of range.".format(section_index))
    return sections[section_index]


def find_channel_by_args(section, args):
    channel_type = args.get("channel_type")
    if channel_type:
        channel_class = resolve_channel_class(channel_type)
        channels = list(section.find_channels_by_type(channel_class))
    else:
        channels = list(section.get_channels())

    if args.get("channel_name"):
        needle = str(args.get("channel_name")).lower()
        channels = [
            channel
            for channel in channels
            if needle == text_to_string(channel.get_name()).lower()
            or needle in text_to_string(channel.get_name()).lower()
        ]

    if not channels:
        raise ValueError("Channel not found.")

    channel_index = int(args.get("channel_index") or 0)
    if channel_index < 0 or channel_index >= len(channels):
        raise ValueError("channel_index {0} is out of range.".format(channel_index))
    return channels[channel_index]


def coerce_key_value(channel, value):
    channel_class = class_name(channel).lower()
    if "bool" in channel_class:
        return bool(value)
    if "integer" in channel_class or "byte" in channel_class:
        return int(value)
    if "float" in channel_class:
        return float(value)
    if "string" in channel_class:
        return str(value)
    return value


def add_key(args):
    sequence = load_sequence_from_args(args)
    track = find_track_by_args(sequence, args)
    section = find_section_by_args(track, args)
    channel = find_channel_by_args(section, args)
    if "value" not in args:
        raise ValueError("value is required")

    frame_number = frame_number_for_time(sequence, args)
    sub_frame = float(args.get("sub_frame") or 0.0)
    unit = time_unit_enum(args.get("time_unit"))
    value = coerce_key_value(channel, args.get("value"))

    if unit is not None:
        key = channel.add_key(frame_number, value, sub_frame, unit)
    else:
        key = channel.add_key(frame_number, value, sub_frame)

    saved = save_sequence_asset(sequence, args)
    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "saved": saved,
        "track": track_summary(sequence, track, include_sections=False),
        "section": section_summary(sequence, section, include_channels=False),
        "channel": channel_summary(sequence, channel, include_keys=False),
        "key": key_summary(sequence, key),
    }


def make_camera_binding_id(sequence, binding):
    if hasattr(sequence, "get_binding_id"):
        try:
            return sequence.get_binding_id(binding)
        except Exception:
            pass
    if hasattr(sequence, "make_binding_id"):
        try:
            return sequence.make_binding_id(binding, unreal.MovieSceneObjectBindingSpace.LOCAL)
        except Exception:
            return sequence.make_binding_id(binding)
    raise RuntimeError("Cannot create camera binding ID in this UE4.27 Python environment.")


def add_camera_cut(args):
    sequence = load_sequence_from_args(args)
    binding = find_binding_by_args(sequence, args, required=False)
    if not binding:
        actor_args = dict(args)
        if args.get("camera_actor_name") and not actor_args.get("actor_name"):
            actor_args["actor_name"] = args.get("camera_actor_name")
        bind_result = bind_actor(actor_args)
        binding = find_binding_by_args(sequence, {"binding_id": bind_result["binding"]["id"]})

    camera_tracks = list(sequence.find_master_tracks_by_type(unreal.MovieSceneCameraCutTrack))
    track = camera_tracks[0] if camera_tracks else sequence.add_master_track(unreal.MovieSceneCameraCutTrack)
    section = track.add_section()
    set_section_range_from_args(section, args)
    binding_id = make_camera_binding_id(sequence, binding)

    try:
        section.set_camera_binding_id(binding_id)
    except Exception:
        section.set_editor_property("CameraBindingID", binding_id)

    saved = save_sequence_asset(sequence, args)
    return {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "saved": saved,
        "binding": binding_summary(sequence, binding, include_tracks=False),
        "track": track_summary(sequence, track, include_sections=False),
        "section": section_summary(sequence, section),
    }


def is_speed_track(track):
    lowered = "{0} {1} {2}".format(
        class_name(track),
        get_object_name(track),
        text_to_string(track.get_display_name()) if hasattr(track, "get_display_name") else "",
    ).lower()
    if "slomo" in lowered or "time dilation" in lowered or "timedilation" in lowered or "play rate" in lowered:
        return True
    try:
        property_text = "{0} {1}".format(track.get_property_name(), track.get_property_path()).lower()
        return "timedilation" in property_text or "time_dilation" in property_text or "playrate" in property_text
    except Exception:
        return False


def collect_speed_tracks(sequence):
    tracks = []
    for track in sequence.get_master_tracks():
        if not is_speed_track(track):
            continue
        track_data = track_summary(sequence, track, include_sections=False)
        sections = []
        points = []
        for section_index, section in enumerate(track.get_sections()):
            section_data = section_summary(sequence, section, include_channels=True, include_keys=True, key_limit=1000)
            section_data["section_index"] = section_index
            sections.append(section_data)
            try:
                channels = section.find_channels_by_type(unreal.MovieSceneScriptingFloatChannel)
            except Exception:
                channels = []
            for channel in channels:
                default_value = channel_default(channel)
                for key in channel.get_keys():
                    key_data = key_summary(sequence, key)
                    points.append(
                        {
                            "seconds": float(key_data.get("seconds") or 0.0),
                            "value": float(key_data.get("value") or 1.0),
                            "channel": text_to_string(channel.get_name()),
                            "section_index": section_index,
                        }
                    )
                if not list(channel.get_keys()) and default_value is not None:
                    start = section_start_seconds(section)
                    points.append(
                        {
                            "seconds": float(start or 0.0),
                            "value": float(default_value),
                            "channel": text_to_string(channel.get_name()),
                            "section_index": section_index,
                            "source": "default",
                        }
                    )
        points.sort(key=lambda item: item["seconds"])
        track_data["sections"] = sections
        track_data["speed_points"] = points
        tracks.append(track_data)
    return tracks


def all_speed_points(speed_tracks):
    points = []
    for track in speed_tracks:
        points.extend(track.get("speed_points") or [])
    points.sort(key=lambda item: item["seconds"])
    return points


def integrate_speed_segments(points, start_seconds, end_seconds, mode="linear", default_speed=1.0):
    warnings = []
    if end_seconds < start_seconds:
        start_seconds, end_seconds = end_seconds, start_seconds
        warnings.append("start_seconds and end_seconds were swapped because target precedes start.")

    relevant = sorted(points, key=lambda item: item["seconds"])
    current_speed = float(default_speed or 1.0)
    current_time = float(start_seconds)
    segments = []

    for point in relevant:
        point_time = float(point["seconds"])
        point_speed = float(point["value"])
        if point_time <= start_seconds:
            current_speed = point_speed
            continue
        if point_time >= end_seconds:
            break

        if point_time > current_time:
            end_speed = point_speed if mode == "linear" else current_speed
            segments.append(
                {
                    "start_seconds": current_time,
                    "end_seconds": point_time,
                    "start_speed": current_speed,
                    "end_speed": end_speed,
                }
            )
        current_time = point_time
        current_speed = point_speed

    if current_time < end_seconds:
        segments.append(
            {
                "start_seconds": current_time,
                "end_seconds": float(end_seconds),
                "start_speed": current_speed,
                "end_speed": current_speed,
            }
        )

    elapsed_real = 0.0
    elapsed_scaled = 0.0
    has_infinite = False
    for segment in segments:
        duration = segment["end_seconds"] - segment["start_seconds"]
        a = float(segment["start_speed"])
        b = float(segment["end_speed"])
        elapsed_scaled += duration * ((a + b) / 2.0)
        if abs(a) < 1e-6 or abs(b) < 1e-6:
            has_infinite = True
            segment["real_seconds"] = None
            warnings.append("A zero or near-zero speed segment makes adjusted real time unbounded.")
            continue
        if mode == "linear" and abs(a - b) > 1e-6 and a > 0 and b > 0:
            real_seconds = duration * (math.log(b) - math.log(a)) / (b - a)
        else:
            real_seconds = duration / a
        segment["real_seconds"] = real_seconds
        elapsed_real += real_seconds

    return {
        "segments": segments,
        "elapsed_sequence_seconds": float(end_seconds) - float(start_seconds),
        "elapsed_real_seconds_assuming_speed_multiplier": None if has_infinite else elapsed_real,
        "elapsed_scaled_seconds_assuming_time_dilation": elapsed_scaled,
        "integration_mode": mode,
        "warnings": warnings,
    }


def analyze_playback_speed(args):
    sequence = load_sequence_from_args(args)
    speed_tracks = collect_speed_tracks(sequence)
    points = all_speed_points(speed_tracks)
    result = {
        "success": True,
        "asset_path": get_asset_package_name(sequence),
        "speed_track_count": len(speed_tracks),
        "speed_tracks": speed_tracks,
        "message": "No MovieSceneSlomoTrack or time-dilation/play-rate-looking master track was found."
        if not speed_tracks
        else "Found speed-related Sequencer track data.",
    }

    if args.get("target_seconds") is not None or args.get("target_frame") is not None:
        result["calculation"] = calculate_playback_time(args)

    if not points:
        result["default_speed"] = 1.0
    return result


def calculate_playback_time(args):
    sequence = load_sequence_from_args(args)
    start_seconds = (
        float(args.get("start_seconds"))
        if args.get("start_seconds") is not None
        else float(sequence.get_playback_start_seconds())
    )
    if args.get("target_seconds") is not None:
        target_seconds = float(args.get("target_seconds"))
    elif args.get("target_frame") is not None:
        target_seconds = frame_to_seconds(int(args.get("target_frame")), get_display_rate(sequence))
    elif args.get("end_seconds") is not None:
        target_seconds = float(args.get("end_seconds"))
    elif args.get("end_frame") is not None:
        target_seconds = frame_to_seconds(int(args.get("end_frame")), get_display_rate(sequence))
    else:
        raise ValueError("target_seconds, target_frame, end_seconds, or end_frame is required")

    mode = str(args.get("integration_mode") or "linear").lower()
    if mode not in ("linear", "constant"):
        mode = "linear"

    speed_tracks = collect_speed_tracks(sequence)
    points = all_speed_points(speed_tracks)
    integration = integrate_speed_segments(points, start_seconds, target_seconds, mode=mode)
    integration.update(
        {
            "success": True,
            "asset_path": get_asset_package_name(sequence),
            "start_seconds": start_seconds,
            "target_seconds": target_seconds,
            "speed_track_count": len(speed_tracks),
            "speed_point_count": len(points),
            "note": "The real-time result assumes the speed track value is a sequence playback multiplier. Cubic tangent curves are approximated with the selected integration mode.",
        }
    )
    return integration
