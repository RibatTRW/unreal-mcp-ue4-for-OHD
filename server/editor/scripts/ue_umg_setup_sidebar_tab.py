import json


def sidebar_creation_failure(reason, widget_blueprint_path):
    return {
        "success": False,
        "message": "Sidebar asset not found and automatic creation failed ({0}). Create an Editor Utility Widget at {1} by hand (Content Browser Add), then re-run.".format(
            reason, widget_blueprint_path
        ),
    }


def apply_browser_fill(browser_widget, action_word, warnings, slot=None):
    try:
        if slot is None:
            slot = get_canvas_panel_slot(browser_widget)
        if slot and set_canvas_panel_slot_fill(slot):
            touch_editor_object(slot)
            touch_editor_object(browser_widget)
            return True
    except Exception:
        pass
    warnings.append("Browser {0} but full-fill layout could not be applied; set anchors to full in the designer.".format(
        action_word
    ))
    return False


def setup_sidebar_tab(
    widget_blueprint_path,
    url,
    browser_widget_name=None,
    open_tab=True,
):
    warnings = []
    created_asset = False
    created_browser = False
    fill_applied = False
    url_set = False
    widget_blueprint = None
    browser_widget = None
    asset_missing = False
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
    except Exception as exc:
        # Distinguish "absent" (create it) from "present but unloadable"
        # (report it): only a confirmed-missing asset triggers creation.
        try:
            asset_missing = not bool(unreal.EditorAssetLibrary.does_asset_exist(widget_blueprint_path))
        except Exception:
            asset_missing = False
        if not asset_missing:
            return {
                "success": False,
                "message": "Sidebar asset exists but could not be loaded: {0}.".format(unreal_text(exc)),
            }
        widget_blueprint = None

    if not widget_blueprint:
        try:
            create_result = create_umg_widget_blueprint({
                "widget_name": widget_blueprint_path,
                "parent_class": "EditorUtilityWidget",
            })
        except Exception as exc:
            return sidebar_creation_failure(unreal_text(exc), widget_blueprint_path)
        if not create_result.get("success"):
            reason = create_result.get("reason") or create_result.get("message") or "unknown"
            return sidebar_creation_failure(reason, widget_blueprint_path)
        created_asset = True
        try:
            widget_blueprint = load_widget_blueprint(widget_blueprint_path)
        except Exception as exc:
            return {
                "success": False,
                "message": "Sidebar asset was created but could not be reloaded: {0}.".format(unreal_text(exc)),
            }

    try:
        widget_tree = get_widget_tree(widget_blueprint)
        root_widget = get_root_widget(widget_tree)
        root_is_canvas = False
        try:
            root_is_canvas = bool(root_widget) and object_is_instance_of(root_widget, unreal.CanvasPanel)
        except Exception:
            root_is_canvas = False
        if root_is_canvas:
            canvas_widget = root_widget
            canvas_name = get_widget_name(canvas_widget)
        else:
            canvas_result = ensure_canvas_root(widget_blueprint, "SidebarRootCanvas")
            widget_tree = get_widget_tree(widget_blueprint)
            canvas_widget = get_root_widget(widget_tree)
            canvas_name = get_widget_name(canvas_widget)
            warnings.append("Wrapped non-Canvas root under a CanvasPanel ({0}).".format(
                canvas_result.get("previous_root_widget") or "unknown"
            ))

        browser_name = browser_widget_name or "DSHBrowser"
        browser_widget = find_widget_in_tree(widget_tree, browser_name)
        if browser_widget:
            browser_label = get_widget_name(browser_widget)
            fill_applied = apply_browser_fill(browser_widget, "reused", warnings)
        else:
            try:
                browser_widget = create_widget_instance(widget_tree, "WebBrowser", browser_name)
            except Exception as exc:
                hint = ""
                if "Could not find widget class" in unreal_text(exc):
                    hint = " Ensure the WebBrowserWidget plugin is enabled (Edit -> Plugins) and the editor was restarted afterwards."
                return {
                    "success": False,
                    "message": "Could not create the WebBrowser widget: {0}.{1}".format(unreal_text(exc), hint),
                }
            slot = add_widget_to_tree(widget_tree, browser_widget, canvas_widget)
            fill_applied = apply_browser_fill(browser_widget, "added", warnings, slot=slot)
            created_browser = True
            browser_label = get_widget_name(browser_widget)

        try:
            asset_name = unreal_text(widget_blueprint_path).strip().rsplit("/", 1)[-1]
            sub_path = "{0}.{1}:WidgetTree.{2}".format(widget_blueprint_path, asset_name, browser_label)
            browser_object = unreal.load_object(None, sub_path)
            if not browser_object:
                raise ValueError("Could not load browser subobject for URL assignment.")
            browser_object.set_editor_property("initial_url", unreal_text(url))
            url_set = True
        except Exception as exc:
            warnings.append("Browser URL could not be set automatically ({0}); set Initial URL in the designer Details panel.".format(
                unreal_text(exc)[:160]
            ))

        saved = bool(save_widget_blueprint(widget_blueprint))
        if not saved:
            rolled_back = False
            deleted_asset = False
            try:
                if created_browser and browser_widget:
                    remove_widget_from_blueprint_tree(widget_tree, browser_widget)
                    rolled_back = bool(save_widget_blueprint(widget_blueprint))
            except Exception:
                rolled_back = False
            try:
                if created_asset:
                    deleted_asset = bool(unreal.EditorAssetLibrary.delete_asset(widget_blueprint_path))
                    if not deleted_asset:
                        warnings.append("New sidebar asset could not be removed after save failure; delete {0} in the Content Browser by hand.".format(
                            widget_blueprint_path
                        ))
            except Exception as exc:
                warnings.append("New sidebar asset could not be removed after save failure ({0}); delete {1} in the Content Browser by hand.".format(
                    unreal_text(exc)[:160], widget_blueprint_path
                ))
            return {
                "success": False,
                "message": "Sidebar tab content was prepared but the widget blueprint could not be saved.",
                "rolled_back_new_browser": rolled_back,
                "deleted_new_asset": deleted_asset,
                "warnings": warnings,
            }

        tab_state = None
        tab_reason = "not requested"
        if open_tab:
            tab_state = False
            tab_reason = ""
            try:
                subsystem = unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem)
                tab_state = bool(subsystem.spawn_and_register_tab(widget_blueprint))
                if not tab_state:
                    tab_reason = "spawn_and_register_tab reported failure"
            except Exception as exc:
                tab_reason = unreal_text(exc)[:200]

        next_steps = []
        if created_asset or created_browser or fill_applied:
            next_steps.append("Compile the widget blueprint in the designer if the opened tab looks stale, then dock the tab beside the viewport.")

        return {
            "success": True,
            "asset_path": widget_blueprint_path,
            "created_asset": created_asset,
            "canvas_widget_name": canvas_name,
            "browser_widget_name": browser_label,
            "created_browser": created_browser,
            "fill_applied": fill_applied,
            "url": unreal_text(url),
            "url_set": url_set,
            "saved": saved,
            "tab_opened": tab_state,
            "tab_reason": tab_reason,
            "warnings": warnings,
            "next_steps": next_steps,
        }
    except Exception as exc:
        return {"success": False, "message": "Failed to set up sidebar tab: {0}".format(unreal_text(exc))}


def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    url = decode_template_json("""${url}""")
    browser_widget_name = decode_template_json("""${browser_widget_name}""")
    open_tab = decode_template_json("""${open_tab}""")

    result = setup_sidebar_tab(
        widget_blueprint_path=widget_blueprint_path,
        url=url,
        browser_widget_name=browser_widget_name,
        open_tab=open_tab if open_tab is not None else True,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
