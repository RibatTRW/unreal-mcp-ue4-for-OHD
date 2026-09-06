

OPERATIONS = {
    "get_source_control_provider": _provider_info,
    "query_source_control_state": _query_state,
    "query_source_control_states": _query_states,
    "check_out_file": _run_file_operation(
        "check_out_file",
        ("check_out_file", "CheckOutFile"),
        single_key="file",
    ),
    "check_out_files": _run_file_operation(
        "check_out_files",
        ("check_out_files", "CheckOutFiles"),
        multi_key="files",
    ),
    "check_out_or_add_file": _run_file_operation(
        "check_out_or_add_file",
        ("check_out_or_add_file", "CheckOutOrAddFile"),
        single_key="file",
    ),
    "check_out_or_add_files": _run_file_operation(
        "check_out_or_add_files",
        ("check_out_or_add_files", "CheckOutOrAddFiles"),
        multi_key="files",
    ),
    "mark_file_for_add": _run_file_operation(
        "mark_file_for_add",
        ("mark_file_for_add", "MarkFileForAdd"),
        single_key="file",
    ),
    "mark_files_for_add": _run_file_operation(
        "mark_files_for_add",
        ("mark_files_for_add", "MarkFilesForAdd"),
        multi_key="files",
    ),
    "mark_file_for_delete": _run_file_operation(
        "mark_file_for_delete",
        ("mark_file_for_delete", "MarkFileForDelete"),
        single_key="file",
    ),
    "mark_files_for_delete": _run_file_operation(
        "mark_files_for_delete",
        ("mark_files_for_delete", "MarkFilesForDelete"),
        multi_key="files",
    ),
    "revert_file": _run_file_operation(
        "revert_file",
        ("revert_file", "RevertFile"),
        single_key="file",
    ),
    "revert_files": _run_file_operation(
        "revert_files",
        ("revert_files", "RevertFiles"),
        multi_key="files",
    ),
    "revert_unchanged_files": _run_file_operation(
        "revert_unchanged_files",
        ("revert_unchanged_files", "RevertUnchangedFiles"),
        multi_key="files",
    ),
    "sync_file": _run_file_operation(
        "sync_file",
        ("sync_file", "SyncFile"),
        single_key="file",
    ),
    "sync_files": _run_file_operation(
        "sync_files",
        ("sync_files", "SyncFiles"),
        multi_key="files",
    ),
    "check_in_files": _run_file_operation(
        "check_in_files",
        ("check_in_files", "CheckInFiles"),
        multi_key="files",
        description_key="description",
        keep_checked_out_key="keep_checked_out",
    ),
    "revert_and_reload_packages": _revert_and_reload_packages,
}

dispatch_main("source control tool")
