# Mystery-origin probe: GenerateWidgetForObject/String, GetWidget and
# WidgetLibrary are all callable, but are they factories, game widgets,
# or something else? Report each one's outer package (engine vs game),
# base classes, and any construction-flavored members. No PIE needed.
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


def _outer_chain(obj, depth=0):
    try:
        outer = obj.get_outer()
    except Exception:
        return []
    chain = []
    while outer is not None and depth < 4:
        try:
            chain.append(_text(outer.get_name())[:80])
            outer = outer.get_outer()
        except Exception:
            break
        depth += 1
    return chain


report = {"success": True}
try:
    for name in ("GenerateWidgetForObject", "GenerateWidgetForString",
                 "GetWidget", "WidgetLibrary"):
        attr = getattr(unreal, name, None)
        if attr is None:
            report[name] = "absent"
            continue
        entry = {}
        entry["outer_chain"] = _outer_chain(attr)
        try:
            entry["bases"] = [_text(b)[:80] for b in list(attr.__bases__)]
        except Exception as exc:
            entry["bases"] = "bases_failed:" + _text(exc)[:100]
        try:
            keys = ("creat", "new", "instance", "spawn", "construct",
                    "generate", "make", "build", "widget")
            entry["members"] = [n for n in dir(attr)
                                if any(k in n.lower() for k in keys)]
        except Exception as exc:
            entry["members"] = "dir_failed:" + _text(exc)[:100]
        report[name] = entry
    print(json.dumps(report))
except Exception as exc:
    try:
        print(json.dumps({"success": False, "message": _text(exc)[:300]}))
    except Exception:
        print(json.dumps({"success": False, "message": "unprintable error"}))
