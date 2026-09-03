import json


def update_object(
    actor_name,
    location=None,
    rotation=None,
    scale=None,
    properties=None,
    new_name=None,
):
    try:
        world = get_editor_world()
        if not world:
            return {"error": "No world loaded"}

        target_actor = find_actor_by_name(actor_name)
        if not target_actor:
            return {"error": "Actor not found: {0}".format(actor_name)}

        if location:
            new_location = unreal.Vector(
                x=location.get("x", target_actor.get_actor_location().x),
                y=location.get("y", target_actor.get_actor_location().y),
                z=location.get("z", target_actor.get_actor_location().z),
            )
            target_actor.set_actor_location(new_location, False, False)

        if rotation:
            new_rotation = unreal.Rotator(
                pitch=rotation.get("pitch", target_actor.get_actor_rotation().pitch),
                yaw=rotation.get("yaw", target_actor.get_actor_rotation().yaw),
                roll=rotation.get("roll", target_actor.get_actor_rotation().roll),
            )
            target_actor.set_actor_rotation(new_rotation, False)

        if scale:
            new_scale = unreal.Vector(
                x=scale.get("x", target_actor.get_actor_scale3d().x),
                y=scale.get("y", target_actor.get_actor_scale3d().y),
                z=scale.get("z", target_actor.get_actor_scale3d().z),
            )
            target_actor.set_actor_scale3d(new_scale)

        if new_name:
            target_actor.set_actor_label(new_name)

        if properties:
            for prop_name, prop_value in properties.items():
                try:
                    apply_actor_property(target_actor, prop_name, prop_value)
                except Exception:
                    continue

        return {
            "success": True,
            "actor_name": target_actor.get_name(),
            "actor_label": target_actor.get_actor_label(),
            "class": target_actor.get_class().get_name(),
            "location": {
                "x": target_actor.get_actor_location().x,
                "y": target_actor.get_actor_location().y,
                "z": target_actor.get_actor_location().z,
            },
            "rotation": {
                "pitch": target_actor.get_actor_rotation().pitch,
                "yaw": target_actor.get_actor_rotation().yaw,
                "roll": target_actor.get_actor_rotation().roll,
            },
            "scale": {
                "x": target_actor.get_actor_scale3d().x,
                "y": target_actor.get_actor_scale3d().y,
                "z": target_actor.get_actor_scale3d().z,
            },
        }
    except Exception as e:
        return {"error": "Failed to update object: {0}".format(unreal_text(e))}


def main():
    # All template variables arrive via the one codec (jsonArg on the TS
    # side, decode_template_arg here): base64(JSON) inside triple quotes.
    try:
        actor_name = decode_template_arg("actor_name", """${actor_name}""")
        location = decode_template_arg("location", """${location}""")
        rotation = decode_template_arg("rotation", """${rotation}""")
        scale = decode_template_arg("scale", """${scale}""")
        properties = decode_template_arg("properties", """${properties}""")
        new_name = decode_template_arg("new_name", """${new_name}""")
    except ArgDecodeError as exc:
        print(json.dumps(arg_decode_failure(exc.arg_name), indent=2))
        return

    result = update_object(
        actor_name=actor_name,
        location=location,
        rotation=rotation,
        scale=scale,
        properties=properties,
        new_name=new_name,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
