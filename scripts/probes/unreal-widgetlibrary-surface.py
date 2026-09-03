# WidgetLibrary mystery probe: the factory sweep surfaced unfamiliar
# names (WidgetLibrary, GenerateWidgetForObject/String, GetWidget).
# Determine what they ARE (callable? a class? whose members?) and whether
# any of them can construct a UUserWidget. No PIE needed.
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
    for name in ("GenerateWidgetForObject", "GenerateWidgetForString",
                 "GetWidget", "WidgetLibrary"):
        attr = getattr(unreal, name, None)
        if attr is None:
            report[name] = "absent"
            continue
        entry = {"type": _text(type(attr))[:80]}
        try:
            entry["callable"] = bool(callable(attr))
        except Exception:
            entry["callable"] = "unknown"
        report[name] = entry

    lib = getattr(unreal, "WidgetLibrary", None)
    if lib is not None:
        try:
            keys = ("creat", "new", "instance", "spawn", "construct",
                    "generate", "make", "build")
            report["WidgetLibrary_members"] = [
                n for n in dir(lib) if any(k in n.lower() for k in keys)
            ]
        except Exception as exc:
            report["WidgetLibrary_members"] = "dir_failed:" + _text(exc)[:100]

    eus = getattr(unreal, "EditorUtilitySubsystem", None)
    if eus is not None:
        try:
            keys = ("spawn", "tab", "register", "widget")
            report["EUS_members"] = [
                n for n in dir(eus) if any(k in n.lower() for k in keys)
            ]
        except Exception as exc:
            report["EUS_members"] = "dir_failed:" + _text(exc)[:100]
    print(json.dumps(report))
except Exception as exc:
    try:
        print(json.dumps({"success": False, "message": _text(exc)[:300]}))
    except Exception:
        print(json.dumps({"success": False, "message": "unprintable error"}))
