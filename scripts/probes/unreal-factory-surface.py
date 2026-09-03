# Factory-surface sweep: list every unreal-module member that could
# construct objects or touch UMG (broad dir() filters). No PIE needed.
# Decides between "wire in a factory" and "SKIP viewport tests".
# Python 2.7 safe.
import json


def _text(value):
    try:
        return unicode(value)
    except Exception:
        try:
            return unicode(str(value))
        except Exception:
            return u"<undecodable>"


report = {"success": True}
try:
    names = list(dir(unreal))
    report["unreal_total"] = len(names)
    factory_keys = ("new", "construct", "spawn", "create", "factory")
    report["factory_hits"] = [n for n in names
                              if any(k in n.lower() for k in factory_keys)]
    report["widget_hits"] = [n for n in names
                             if "widget" in n.lower() or "umg" in n.lower()]
    extra = {}
    if hasattr(unreal, "GameplayStatics"):
        try:
            extra["GS_create_widget"] = [n for n in dir(unreal.GameplayStatics)
                                         if "creat" in n.lower() or "widget" in n.lower()]
        except Exception as exc:
            extra["GS_create_widget"] = "dir_failed:" + _text(exc)[:100]
    for lib in ("WidgetLayoutLibrary", "EditorUtilitySubsystem",
                "EditorUtilityWidget", "GameInstance", "GameInstanceSubsystem"):
        extra["has_" + lib] = hasattr(unreal, lib)
    report["extra"] = extra
    print(json.dumps(report))
except Exception as exc:
    try:
        print(json.dumps({"success": False, "message": _text(exc)[:300]}))
    except Exception:
        print(json.dumps({"success": False, "message": "unprintable error"}))
