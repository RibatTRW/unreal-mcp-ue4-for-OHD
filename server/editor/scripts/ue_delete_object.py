import json


def delete_object(actor_name):
    try:
        world = get_editor_world()
        if not world:
            return {"error": "No world loaded"}

        target_actor = find_actor_by_name(actor_name)
        if not target_actor:
            return {"error": "Actor not found: {0}".format(actor_name)}

        actor_info = {
            "actor_name": target_actor.get_name(),
            "actor_label": target_actor.get_actor_label(),
            "class": target_actor.get_class().get_name(),
            "location": {
                "x": target_actor.get_actor_location().x,
                "y": target_actor.get_actor_location().y,
                "z": target_actor.get_actor_location().z,
            },
        }

        success = destroy_actor(target_actor)
        if success:
            return {
                "success": True,
                "message": "Successfully deleted actor: {0}".format(actor_name),
                "deleted_actor": actor_info,
            }

        return {"error": "Failed to delete actor: {0}".format(actor_name)}
    except Exception as e:
        return {"error": "Failed to delete object: {0}".format(unreal_text(e))}


def delete_multiple_objects(actor_names):
    try:
        results = []
        for actor_name in actor_names:
            result = delete_object(actor_name)
            results.append(result)

        return {
            "success": True,
            "total_requested": len(actor_names),
            "results": results,
        }

    except Exception as e:
        return {"error": "Failed to delete multiple objects: {0}".format(unreal_text(e))}


def normalize_actor_names(decoded_value):
    """Explicit single/multi-shape normalization for the delete call site.

    The codec decodes exactly one value; the shapes callers send (a single
    name, or a JSON list of names in one string, as the old literal_eval
    path accepted) are normalized here, in the open. Returns None when
    there is nothing to delete.
    """
    if decoded_value is None:
        return None

    if isinstance(decoded_value, list):
        return decoded_value

    if isinstance(decoded_value, _string_types):
        stripped = decoded_value.strip()
        if not stripped:
            return None
        if stripped.startswith("["):
            try:
                parsed = json.loads(stripped)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return stripped

    return decoded_value


def main():
    # actor_names arrives via the one codec (jsonArg on the TS side,
    # decode_template_arg here): base64(JSON) inside triple quotes.
    try:
        actor_names = normalize_actor_names(
            decode_template_arg("actor_names", """${actor_names}""")
        )
    except ArgDecodeError as exc:
        print(json.dumps(arg_decode_failure(exc.arg_name), indent=2))
        return

    if isinstance(actor_names, list):
        result = delete_multiple_objects(actor_names)
    elif isinstance(actor_names, _string_types):
        result = delete_object(actor_names)
    elif actor_names is None:
        result = {"error": "actor_names is required"}
    else:
        result = delete_object(unreal_text(actor_names))

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
