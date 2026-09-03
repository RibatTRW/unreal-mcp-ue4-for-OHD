# Widget API-surface + instantiation-ladder probe (self-contained).
# Section 0 (no PIE needed): which creation APIs exist on this build.
# Section 1 (needs PIE): find a real WidgetBlueprint via the registry,
# load its class, and try every instantiation rung, recording each
# outcome INCLUDING exception text. Adds the first viable instance to
# the viewport and immediately removes it.
# Needs a game world: run pie-start.py ~15s beforehand or expect
# need_pie:true (section 0 still reports). Python 2.7 safe.
import json


def _text(value):
    try:
        return unicode(value)
    except Exception:
        try:
            return unicode(str(value))
        except Exception:
            return u"<undecodable>"


def _game_world():
    try:
        if hasattr(unreal.EditorLevelLibrary, "get_game_world"):
            return unreal.EditorLevelLibrary.get_game_world()
    except Exception:
        pass
    return None


def _try(label, fn, out):
    try:
        result = fn()
    except Exception as exc:
        out.append({"label": label, "ok": False, "error": _text(exc)[:200]})
        return None
    out.append({
        "label": label,
        "ok": result is not None,
        "has_add_to_viewport": bool(hasattr(result, "add_to_viewport")) if result is not None else False,
    })
    return result


report = {"success": True}
try:
    surface = {}
    surface["has_UserWidget"] = hasattr(unreal, "UserWidget")
    try:
        if surface["has_UserWidget"]:
            surface["UserWidget_dir_create"] = [
                n for n in dir(unreal.UserWidget)
                if "creat" in n.lower() or "instance" in n.lower()
            ]
        else:
            surface["UserWidget_dir_create"] = []
    except Exception as exc:
        surface["UserWidget_dir_create"] = "dir_failed:" + _text(exc)[:100]
    surface["has_WidgetBlueprintLibrary"] = hasattr(unreal, "WidgetBlueprintLibrary")
    try:
        if surface["has_WidgetBlueprintLibrary"]:
            surface["WBL_dir_create"] = [
                n for n in dir(unreal.WidgetBlueprintLibrary)
                if "creat" in n.lower()
            ]
        else:
            surface["WBL_dir_create"] = []
    except Exception as exc:
        surface["WBL_dir_create"] = "dir_failed:" + _text(exc)[:100]
    surface["has_new_object"] = hasattr(unreal, "new_object")
    report["surface"] = surface

    world = _game_world()
    report["has_game_world"] = world is not None
    if world is None:
        report["need_pie"] = True
        print(json.dumps(report))
    else:
        found = []
        try:
            registry = unreal.AssetRegistryHelpers.get_asset_registry()
            try:
                datas = registry.get_assets_by_class("WidgetBlueprint", True)
            except Exception:
                datas = registry.get_assets_by_class("WidgetBlueprint")
            for data in list(datas)[:5]:
                for getter in ("object_path", "package_name"):
                    try:
                        found.append(_text(getattr(data, getter)))
                        break
                    except Exception:
                        continue
        except Exception as exc:
            report["registry_error"] = _text(exc)[:200]
        report["found_paths"] = found[:5]

        widget_class = None
        if found:
            try:
                widget_class = unreal.EditorAssetLibrary.load_blueprint_class(found[0])
            except Exception as exc:
                report["load_blueprint_class_error"] = _text(exc)[:200]
            if widget_class is None:
                try:
                    base = found[0].rsplit("/", 1)[-1]
                    widget_class = unreal.load_class(None, found[0] + "." + base + "_C")
                except Exception as exc:
                    report["load_class_error"] = _text(exc)[:200]
        report["have_class"] = widget_class is not None

        player = None
        if widget_class is not None:
            try:
                player = unreal.GameplayStatics.get_player_controller(world, 0)
            except Exception as exc:
                report["player_error"] = _text(exc)[:200]
            report["have_player"] = player is not None

            ladder = []
            inst = None
            if hasattr(unreal, "UserWidget") and hasattr(unreal.UserWidget, "create_widget_instance"):
                inst = _try("UserWidget.create_widget_instance(world,class,name)",
                            lambda: unreal.UserWidget.create_widget_instance(
                                world, widget_class, widget_class.get_name()),
                            ladder)
            else:
                ladder.append({"label": "UserWidget.create_widget_instance", "ok": False,
                               "error": "absent"})
            if inst is None and surface["has_WidgetBlueprintLibrary"]:
                for meth in surface["WBL_dir_create"] or ["create"]:
                    if inst is not None:
                        break
                    inst = _try("WBL." + meth + "(world,class,player)",
                                lambda m=meth: getattr(unreal.WidgetBlueprintLibrary, m)(
                                    world, widget_class, player),
                                ladder)
            if inst is None:
                inst = _try("class(world)",
                            lambda: widget_class(world), ladder)
            if inst is None:
                inst = _try("class(world,name)",
                            lambda: widget_class(world, "ProbeWidget1"), ladder)
            if inst is None and player is not None:
                inst = _try("class(player)",
                            lambda: widget_class(player), ladder)
            report["ladder"] = ladder
            report["instantiated"] = inst is not None

            if inst is not None and hasattr(inst, "add_to_viewport"):
                try:
                    inst.add_to_viewport(0)
                    report["viewport_add"] = True
                    try:
                        inst.remove_from_parent()
                        report["viewport_remove"] = True
                    except Exception as exc:
                        report["viewport_remove"] = "failed:" + _text(exc)[:100]
                except Exception as exc:
                    report["viewport_add"] = "failed:" + _text(exc)[:200]
        print(json.dumps(report))
except Exception as exc:
    try:
        print(json.dumps({"success": False, "message": _text(exc)[:300]}))
    except Exception:
        print(json.dumps({"success": False, "message": "unprintable error"}))
