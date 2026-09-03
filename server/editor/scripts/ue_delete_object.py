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
        return {"error": "Failed to delete object: {0}".format(str(e))}


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
        return {"error": "Failed to delete multiple objects: {0}".format(str(e))}


def main():
    actor_names_input = "${actor_names}"

    try:
        import ast

        actor_names = ast.literal_eval(actor_names_input)
        if isinstance(actor_names, list):
            result = delete_multiple_objects(actor_names)
        else:
            result = delete_object(str(actor_names))
    except Exception:
        result = delete_object(actor_names_input)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
