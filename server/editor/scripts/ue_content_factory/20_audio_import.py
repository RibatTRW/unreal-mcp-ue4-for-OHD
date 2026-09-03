def import_audio(args):
    source_file = str(
        args.get("source_file") or args.get("file_path") or args.get("local_path") or ""
    ).strip()
    destination_path = args.get("destination_path") or args.get("content_path") or "/Game/ImportedAudio"
    asset_name = args.get("asset_name") or args.get("name")
    replace_existing = bool(args.get("replace_existing", True))
    save_asset = bool(args.get("save", True))
    auto_create_cue = bool(args.get("auto_create_cue", True))
    cue_suffix = str(args.get("cue_suffix") or "_Cue").strip()

    if not source_file:
        return {
            "success": False,
            "message": "source_file, file_path, or local_path is required.",
        }

    normalized_source_file = os.path.normpath(source_file)
    if not os.path.isfile(normalized_source_file):
        return {
            "success": False,
            "message": "Source file does not exist: {0}".format(normalized_source_file),
        }

    if not asset_name:
        asset_name = os.path.splitext(os.path.basename(normalized_source_file))[0]

    try:
        asset_leaf_name, package_path = split_asset_name_and_path(asset_name, destination_path)
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    task_class = getattr(unreal, "AssetImportTask", None)
    helpers_class = getattr(unreal, "AssetToolsHelpers", None)
    if not task_class or not helpers_class:
        return {
            "success": False,
            "message": "Audio import tasks are not exposed in this UE4.25 Python environment.",
        }

    try:
        import_task = task_class()
        set_object_property(import_task, "filename", normalized_source_file)
        set_object_property(import_task, "destination_path", package_path)
        set_object_property(import_task, "destination_name", asset_leaf_name)
        set_object_property(import_task, "replace_existing", replace_existing)
        set_object_property(import_task, "automated", True)
        set_object_property(import_task, "save", save_asset)

        asset_tools = helpers_class.get_asset_tools()
        asset_tools.import_asset_tasks([import_task])
    except Exception as exc:
        return {"success": False, "message": str(exc)}

    imported_object_paths = [
        normalize_asset_reference_path(str(imported_path))
        for imported_path in (
            get_editor_property_value(import_task, "imported_object_paths", []) or []
        )
        if imported_path
    ]

    sound_wave_asset = None
    sound_cue_asset = None
    for imported_path in imported_object_paths:
        imported_asset = _load_editor_asset(imported_path)
        if not imported_asset:
            continue

        imported_class_name = get_object_class_name(imported_asset)
        if "SoundCue" in imported_class_name and sound_cue_asset is None:
            sound_cue_asset = imported_asset
            continue

        if "SoundWave" in imported_class_name and sound_wave_asset is None:
            sound_wave_asset = imported_asset

    expected_sound_wave_path = "{0}/{1}".format(package_path, asset_leaf_name)
    if sound_wave_asset is None:
        sound_wave_asset = _load_editor_asset(expected_sound_wave_path)

    expected_sound_cue_path = ""
    if auto_create_cue:
        cue_factory_class = _resolve_factory_class("SoundCueFactoryNew")
        sound_cue_class = resolve_class_reference("SoundCue", ["Engine"])
        if not cue_factory_class or not sound_cue_class:
            return {
                "success": False,
                "message": "SoundCueFactoryNew is not exposed in this UE4.25 Python environment.",
                "sound_wave_path": get_asset_package_name(sound_wave_asset)
                or expected_sound_wave_path,
            }

        expected_sound_cue_path = "{0}/{1}{2}".format(package_path, asset_leaf_name, cue_suffix)

        if replace_existing:
            try:
                unreal.EditorAssetLibrary.delete_asset(expected_sound_cue_path)
            except Exception:
                pass

        try:
            cue_factory = cue_factory_class()
            if not set_object_property(cue_factory, "InitialSoundWaves", [sound_wave_asset]):
                set_object_property(cue_factory, "initial_sound_waves", [sound_wave_asset])
            sound_cue_asset = create_asset_with_factory(
                "{0}{1}".format(asset_leaf_name, cue_suffix),
                package_path,
                sound_cue_class,
                cue_factory,
            )
        except Exception as exc:
            return {"success": False, "message": str(exc)}

        if sound_cue_asset is None:
            sound_cue_asset = _load_editor_asset(expected_sound_cue_path)

    if sound_wave_asset is None:
        return {
            "success": False,
            "message": "Audio import completed but no SoundWave asset could be resolved.",
            "source_file": normalized_source_file,
            "expected_asset_path": expected_sound_wave_path,
            "imported_object_paths": imported_object_paths,
        }

    if auto_create_cue and sound_cue_asset is None:
        return {
            "success": False,
            "message": "Audio import completed but no SoundCue asset could be resolved.",
            "source_file": normalized_source_file,
            "expected_sound_wave_path": expected_sound_wave_path,
            "expected_sound_cue_path": expected_sound_cue_path,
            "imported_object_paths": imported_object_paths,
        }

    if save_asset:
        try:
            save_loaded_editor_asset(sound_wave_asset)
        except Exception:
            pass

        if sound_cue_asset is not None:
            try:
                save_loaded_editor_asset(sound_cue_asset)
            except Exception:
                pass

    return {
        "success": True,
        "source_file": normalized_source_file,
        "sound_wave": _asset_summary(sound_wave_asset),
        "sound_wave_path": get_asset_package_name(sound_wave_asset) or expected_sound_wave_path,
        "sound_cue": _asset_summary(sound_cue_asset) if sound_cue_asset else None,
        "sound_cue_path": get_asset_package_name(sound_cue_asset)
        if sound_cue_asset
        else expected_sound_cue_path,
        "imported_object_paths": imported_object_paths,
        "replace_existing": replace_existing,
        "save": save_asset,
        "auto_create_cue": auto_create_cue,
        "cue_suffix": cue_suffix,
    }
