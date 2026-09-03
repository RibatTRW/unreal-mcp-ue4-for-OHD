import json


OPERATIONS = {
    "search_data_assets": search_data_assets,
    "create_data_asset": create_data_asset,
    "create_data_table": create_data_table,
    "create_string_table": create_string_table,
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
                    "message": "Unknown data tool operation: {0}".format(operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": unreal_text(exc)}

    print(json.dumps(result, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
