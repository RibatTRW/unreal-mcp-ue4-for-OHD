def add_component_to_blueprint_via_harvest(
    blueprint,
    component_class,
    component_name,
    location=None,
    rotation=None,
    scale=None,
    component_properties=None,
):
    if not supports_kismet_component_harvest():
        raise ValueError(
            "KismetEditorUtilities.add_components_to_blueprint is not available in this UE4.25 Python environment."
        )

    template_name = str(component_name or "").strip()
    if not template_name:
        raise ValueError("component_name is required")

    temp_actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.Actor,
        unreal.Vector(0.0, 0.0, 0.0),
        unreal.Rotator(0.0, 0.0, 0.0),
    )
    if not temp_actor:
        raise RuntimeError("Failed to spawn a temporary actor for Blueprint component harvest.")

    component_template = None
    try:
        component_template = new_object_compat(component_class, temp_actor, template_name)

        if not component_template:
            raise RuntimeError(
                "Failed to create a temporary component instance: {0}".format(template_name)
            )

        try:
            component_template.rename(template_name, temp_actor)
        except Exception:
            pass

        try:
            if hasattr(temp_actor, "add_instance_component"):
                temp_actor.add_instance_component(component_template)
        except Exception:
            pass

        if class_is_child_of(component_class, unreal.SceneComponent):
            current_root = None
            try:
                current_root = temp_actor.get_root_component()
            except Exception:
                current_root = get_editor_property_value(temp_actor, "root_component")

            if current_root and current_root != component_template:
                try:
                    component_template.attach_to_component(
                        current_root,
                        unreal.AttachmentTransformRules.KEEP_RELATIVE_TRANSFORM,
                    )
                except Exception:
                    try:
                        component_template.setup_attachment(current_root)
                    except Exception:
                        pass
            else:
                try:
                    temp_actor.set_root_component(component_template)
                except Exception:
                    set_object_property(temp_actor, "root_component", component_template)

        try:
            if hasattr(component_template, "on_component_created"):
                component_template.on_component_created()
        except Exception:
            pass

        try:
            if hasattr(component_template, "register_component"):
                component_template.register_component()
        except Exception:
            pass

        apply_scene_component_transform(component_template, location, rotation, scale)

        for property_name, property_value in (component_properties or {}).items():
            apply_component_property(component_template, property_name, property_value)

        harvest_attempts = [
            lambda: unreal.KismetEditorUtilities.add_components_to_blueprint(
                blueprint,
                [component_template],
                True,
            ),
            lambda: unreal.KismetEditorUtilities.add_components_to_blueprint(
                blueprint,
                [component_template],
            ),
        ]

        last_error = None
        for harvest_attempt in harvest_attempts:
            try:
                harvest_attempt()
                break
            except Exception as exc:
                last_error = exc
        else:
            raise last_error if last_error else RuntimeError(
                "Failed to harvest the temporary component into the Blueprint."
            )
    finally:
        try:
            unreal.EditorLevelLibrary.destroy_actor(temp_actor)
        except Exception:
            pass

    return find_blueprint_cdo_component(blueprint, component_name)
