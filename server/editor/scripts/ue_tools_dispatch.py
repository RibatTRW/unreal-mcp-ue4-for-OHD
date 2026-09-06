import json


def dispatch_main(domain_label, ensure_ascii=None):
    operation = decode_template_json("""${operation}""")
    args = decode_template_json("""${args}""")

    handler = OPERATIONS.get(operation)
    if not handler:
        print(
            json.dumps(
                {
                    "success": False,
                    "message": "Unknown {0} operation: {1}".format(domain_label, operation),
                },
                indent=2,
            )
        )
        return

    try:
        result = handler(args or {})
    except Exception as exc:
        result = {"success": False, "message": unreal_text(exc)}

    dump_kwargs = {"indent": 2}
    if ensure_ascii is not None:
        dump_kwargs["ensure_ascii"] = ensure_ascii
    print(json.dumps(result, **dump_kwargs))
