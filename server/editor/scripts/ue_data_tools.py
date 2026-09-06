

OPERATIONS = {
    "search_data_assets": search_data_assets,
    "create_data_asset": create_data_asset,
    "create_data_table": create_data_table,
    "create_string_table": create_string_table,
}

dispatch_main("data tool", ensure_ascii=True)
