import base64
import json
import os


# Object path of the staged template. Coupled to the golden file: its inner
# object is still named EUW_DSHSidebar (verified live: 4.25 needs full
# object paths — package-only existence checks report False and
# duplicate_asset with package-only paths silently does nothing).
TEMPLATE_STAGING_OBJECT = "/Game/DSHSidebarTemplate.EUW_DSHSidebar"
TEMPLATE_BROWSER_NAME = "DSHBrowser"


def asset_exists(asset_path):
    try:
        if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
            return True
        base = unreal_text(asset_path).strip().rsplit("/", 1)[-1]
        return bool(unreal.EditorAssetLibrary.does_asset_exist(asset_path + "." + base))
    except Exception:
        return False


def decode_template_bytes(template_b64):
    try:
        return base64.b64decode(unreal_text(template_b64))
    except Exception:
        return None


def staging_template_file():
    return os.path.join(unreal.Paths.project_content_dir(), "DSHSidebarTemplate.uasset")


def setup_sidebar_from_template(widget_blueprint_path, template_b64, warnings):
    """Duplicate the golden template into a missing target.

    Returns (blueprint_or_None, status) where status is "ok" (fall through
    to the shared tree/URL/save/tab tail), "restart" (staged but undiscovered:
    the caller must report re-run-after-restart), or "scratch" (template
    unusable: the caller falls back to building from scratch).
    """
    data = decode_template_bytes(template_b64)
    if not data:
        warnings.append("Sidebar template payload unreadable; building from scratch.")
        return None, "scratch"
    duplicate = getattr(unreal.EditorAssetLibrary, "duplicate_asset", None)
    if duplicate is None:
        warnings.append("EditorAssetLibrary.duplicate_asset missing here; building from scratch.")
        return None, "scratch"
    if asset_exists(TEMPLATE_STAGING_OBJECT):
        try:
            staged_cleared = bool(unreal.EditorAssetLibrary.delete_asset(TEMPLATE_STAGING_OBJECT))
        except Exception:
            staged_cleared = False
        if not staged_cleared:
            warnings.append("Stale staging template {0} could not be cleared; continuing anyway.".format(
                TEMPLATE_STAGING_OBJECT
            ))
    try:
        handle = open(staging_template_file(), "wb")
        try:
            handle.write(data)
        finally:
            handle.close()
    except Exception as exc:
        try:
            os.remove(staging_template_file())
        except Exception:
            pass
        warnings.append("Sidebar template could not be staged ({0}); building from scratch.".format(
            unreal_text(exc)[:120]
        ))
        return None, "scratch"
    # A runtime-dropped .uasset stays invisible to the 4.25 Asset Registry
    # (verified live: even forced synchronous rescans don't discover it),
    # so the first template run always stages the file and reports
    # restart-and-rerun; the post-restart re-run duplicates from it.
    if not asset_exists(TEMPLATE_STAGING_OBJECT):
        return None, "restart"
    target_base = unreal_text(widget_blueprint_path).strip().rsplit("/", 1)[-1]
    try:
        duplicate(TEMPLATE_STAGING_OBJECT, unreal_text(widget_blueprint_path) + "." + target_base)
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
    except Exception as exc:
        try:
            staged_cleared = bool(unreal.EditorAssetLibrary.delete_asset(TEMPLATE_STAGING_OBJECT))
        except Exception:
            staged_cleared = False
        if not staged_cleared:
            warnings.append("Staging template {0} left behind; delete it by hand.".format(
                TEMPLATE_STAGING_OBJECT
            ))
        warnings.append("Sidebar template duplication failed ({0}); building from scratch.".format(
            unreal_text(exc)[:120]
        ))
        return None, "scratch"
    try:
        staged_cleared = bool(unreal.EditorAssetLibrary.delete_asset(TEMPLATE_STAGING_OBJECT))
    except Exception:
        staged_cleared = False
    if not staged_cleared:
        warnings.append("Staging template {0} left behind; delete it by hand.".format(
            TEMPLATE_STAGING_OBJECT
        ))
    warnings.append("Duplicated the golden sidebar template (browser + On Key Down shortcut fix included).")
    return widget_blueprint, "ok"


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


class _EarlyResult(Exception):
    """Carries a final response out of a setup phase: the orchestrator
    catches it and returns the response unchanged. Lets provision and
    finalize exit early without threading result dicts through callers."""

    def __init__(self, result):
        super(_EarlyResult, self).__init__("early result")
        self.result = result


def provision_sidebar_asset(
    widget_blueprint_path,
    browser_widget_name,
    template_b64,
    template_expected,
    warnings,
):
    """Load-or-create the sidebar asset (provision half).

    Returns (widget_blueprint, browser_widget_name, provision) where
    provision carries created_asset/template_used. The template path
    may clear a custom browser_widget_name (the golden asset ships a
    fixed browser) — callers must use the returned name. Raises
    _EarlyResult with the final response when setup cannot continue
    (unloadable asset, template-staged restart, creation/reload
    failure). Anything else propagates to the orchestrator, which wraps
    it in the generic setup-failure response."""

    created_asset = False
    template_used = False
    widget_blueprint = None
    asset_missing = False
    try:
        widget_blueprint = load_widget_blueprint(widget_blueprint_path)
    except Exception as exc:
        # Distinguish "absent" (create it) from "present but unloadable"
        # (report it): only a confirmed-missing asset triggers creation.
        # asset_exists checks the object path too: 4.25 package-only
        # existence checks report False for perfectly good assets.
        try:
            asset_missing = not asset_exists(widget_blueprint_path)
        except Exception:
            asset_missing = False
        if not asset_missing:
            raise _EarlyResult({
                "success": False,
                "message": "Sidebar asset exists but could not be loaded: {0}.".format(unreal_text(exc)),
            })
        widget_blueprint = None

    if not widget_blueprint:
        if template_expected and not template_b64:
            warnings.append("use_template requested but the server package ships no sidebar template; building from scratch.")
        if template_b64:
            widget_blueprint, template_status = setup_sidebar_from_template(
                widget_blueprint_path, template_b64, warnings
            )
            if template_status == "restart":
                raise _EarlyResult({
                    "success": False,
                    "message": "Sidebar template staged under /Game but not yet visible to the Asset Registry (one-time step). Restart the editor, then re-run setup_sidebar_tab with the same arguments to finish.",
                    "template_staged": True,
                    "warnings": warnings,
                })
            if template_status == "ok":
                template_used = True
                created_asset = True
                if browser_widget_name and unreal_text(browser_widget_name) != TEMPLATE_BROWSER_NAME:
                    warnings.append("Template ships the {0} browser; the requested {1} was ignored so the URL lands on the fixed browser.".format(
                        TEMPLATE_BROWSER_NAME, unreal_text(browser_widget_name)
                    ))
                    browser_widget_name = None
        if not widget_blueprint:
            try:
                create_result = create_umg_widget_blueprint({
                    "widget_name": widget_blueprint_path,
                    "parent_class": "EditorUtilityWidget",
                })
            except Exception as exc:
                raise _EarlyResult(sidebar_creation_failure(unreal_text(exc), widget_blueprint_path))
            if not create_result.get("success"):
                reason = create_result.get("reason") or create_result.get("message") or "unknown"
                raise _EarlyResult(sidebar_creation_failure(reason, widget_blueprint_path))
            created_asset = True
            try:
                widget_blueprint = load_widget_blueprint(widget_blueprint_path)
            except Exception as exc:
                raise _EarlyResult({
                    "success": False,
                    "message": "Sidebar asset was created but could not be reloaded: {0}.".format(unreal_text(exc)),
                })

    return widget_blueprint, browser_widget_name, {
        "created_asset": created_asset,
        "template_used": template_used,
    }


def configure_sidebar_content(
    widget_blueprint,
    widget_blueprint_path,
    url,
    browser_widget_name,
    warnings,
):
    """Canvas root + browser child + initial URL (configure half).

    Returns a content dict with the canvas/browser/url flags plus the
    live widget_tree and browser_widget the save step needs for
    rollback. Raises _EarlyResult when no browser can be provided."""

    created_browser = False
    fill_applied = False
    url_set = False
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
            raise _EarlyResult({
                "success": False,
                "message": "Could not create the WebBrowser widget: {0}.{1}".format(unreal_text(exc), hint),
            })
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

    return {
        "canvas_name": canvas_name,
        "browser_widget": browser_widget,
        "browser_label": browser_label,
        "created_browser": created_browser,
        "fill_applied": fill_applied,
        "url_set": url_set,
        "widget_tree": widget_tree,
    }


def finalize_sidebar_save(
    widget_blueprint,
    widget_tree,
    browser_widget,
    widget_blueprint_path,
    created_asset,
    created_browser,
    warnings,
):
    """Save with rollback (finalize half). Raises _EarlyResult when the
    save fails; returns True when the asset is saved."""

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
        raise _EarlyResult({
            "success": False,
            "message": "Sidebar tab content was prepared but the widget blueprint could not be saved.",
            "rolled_back_new_browser": rolled_back,
            "deleted_new_asset": deleted_asset,
            "warnings": warnings,
        })
    return True


def open_sidebar_tab(widget_blueprint, open_tab):
    """Best-effort tab open. Returns (tab_state, tab_reason)."""

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
    return tab_state, tab_reason


def setup_sidebar_tab(
    widget_blueprint_path,
    url,
    browser_widget_name=None,
    open_tab=True,
    template_b64=None,
    template_expected=None,
):
    warnings = []
    try:
        widget_blueprint, browser_widget_name, provision = provision_sidebar_asset(
            widget_blueprint_path,
            browser_widget_name,
            template_b64,
            template_expected,
            warnings,
        )
        content = configure_sidebar_content(
            widget_blueprint,
            widget_blueprint_path,
            url,
            browser_widget_name,
            warnings,
        )
        saved = finalize_sidebar_save(
            widget_blueprint,
            content["widget_tree"],
            content["browser_widget"],
            widget_blueprint_path,
            provision["created_asset"],
            content["created_browser"],
            warnings,
        )
        tab_state, tab_reason = open_sidebar_tab(widget_blueprint, open_tab)

        next_steps = []
        if provision["created_asset"] or content["created_browser"] or content["fill_applied"]:
            next_steps.append("Compile the widget blueprint in the designer if the opened tab looks stale, then dock the tab beside the viewport.")

        return {
            "success": True,
            "asset_path": widget_blueprint_path,
            "created_asset": provision["created_asset"],
            "template_used": provision["template_used"],
            "canvas_widget_name": content["canvas_name"],
            "browser_widget_name": content["browser_label"],
            "created_browser": content["created_browser"],
            "fill_applied": content["fill_applied"],
            "url": unreal_text(url),
            "url_set": content["url_set"],
            "saved": saved,
            "tab_opened": tab_state,
            "tab_reason": tab_reason,
            "warnings": warnings,
            "next_steps": next_steps,
        }
    except _EarlyResult as early:
        return early.result
    except Exception as exc:
        return {"success": False, "message": "Failed to set up sidebar tab: {0}".format(unreal_text(exc))}

def main():
    widget_blueprint_path = decode_template_json("""${widget_blueprint_path}""")
    url = decode_template_json("""${url}""")
    browser_widget_name = decode_template_json("""${browser_widget_name}""")
    open_tab = decode_template_json("""${open_tab}""")
    template_b64 = decode_template_json("""${template_b64}""")
    template_expected = decode_template_json("""${template_expected}""")

    result = setup_sidebar_tab(
        widget_blueprint_path=widget_blueprint_path,
        url=url,
        browser_widget_name=browser_widget_name,
        open_tab=open_tab if open_tab is not None else True,
        template_b64=template_b64,
        template_expected=template_expected,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
