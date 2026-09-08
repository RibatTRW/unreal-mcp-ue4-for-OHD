import json


# SHIP-S3 bounded reads: server-side paging defaults for the uncapped
# world_outliner dump. The TS paramsSchema (shared-read-only-actions.ts)
# rejects negative / non-integer / over-max limit/offset before dispatch;
# the clamps below are defense-in-depth for direct run_python callers.
# Counts are taken before slicing so total_count stays honest, and only
# the page slice is serialized (slice before serialize).
DEFAULT_PAGE_LIMIT = 200
MAX_PAGE_LIMIT = 2000


def normalize_page_args(limit, offset):
    try:
        page_limit = int(limit)
    except Exception:
        page_limit = DEFAULT_PAGE_LIMIT
    if limit is None:
        page_limit = DEFAULT_PAGE_LIMIT
    if page_limit < 0:
        page_limit = 0
    if page_limit > MAX_PAGE_LIMIT:
        page_limit = MAX_PAGE_LIMIT

    try:
        page_offset = int(offset)
    except Exception:
        page_offset = 0
    if offset is None:
        page_offset = 0
    if page_offset < 0:
        page_offset = 0

    return (page_limit, page_offset)


def normalize_fields(fields):
    if fields is None:
        return None
    if isinstance(fields, list):
        names = []
        for field in fields:
            try:
                text = unreal_text(field)
            except Exception:
                continue
            if text and text not in names:
                names.append(text)
        return names
    try:
        text = unreal_text(fields)
    except Exception:
        return None
    return [text] if text else None


def project_actor_fields(actor_info, fields):
    if fields is None:
        return actor_info
    projected = {}
    for name in fields:
        if name in actor_info:
            projected[name] = actor_info[name]
    return projected


def build_actor_info(actor):
    actor_info = {
        "name": actor.get_name(),
        "label": actor.get_actor_label(),
        "class": actor.get_class().get_name(),
        "location": {
            "x": actor.get_actor_location().x,
            "y": actor.get_actor_location().y,
            "z": actor.get_actor_location().z,
        },
        "rotation": {
            "pitch": actor.get_actor_rotation().pitch,
            "yaw": actor.get_actor_rotation().yaw,
            "roll": actor.get_actor_rotation().roll,
        },
        "scale": {
            "x": actor.get_actor_scale3d().x,
            "y": actor.get_actor_scale3d().y,
            "z": actor.get_actor_scale3d().z,
        },
        "is_hidden": actor.is_hidden_ed(),
        "folder_path": unreal_text(actor.get_folder_path())
        if hasattr(actor, "get_folder_path")
        else None,
    }

    components = actor.get_components_by_class(unreal.ActorComponent)
    if components:
        actor_info["components"] = [
            component.get_class().get_name() for component in components[:5]
        ]

    return actor_info


def get_world_outliner(limit=None, offset=None, fields=None):
    world = get_editor_world()
    if not world:
        return {"error": "No world loaded"}

    page_limit, page_offset = normalize_page_args(limit, offset)
    wanted_fields = normalize_fields(fields)

    all_actors = get_all_level_actors()
    total_count = len(all_actors)

    # Cheap sort keys first so only the page slice pays for full
    # serialization. Actors whose name lookup fails are skipped here,
    # matching the legacy per-actor try/continue below.
    keyed_actors = []
    for actor in all_actors:
        try:
            keyed_actors.append((actor.get_name(), actor))
        except Exception:
            continue

    keyed_actors.sort(key=lambda entry: entry[0] or "")

    page_actors = keyed_actors[page_offset:page_offset + page_limit]

    actors = []
    for _name, actor in page_actors:
        try:
            actors.append(project_actor_fields(build_actor_info(actor), wanted_fields))
        except Exception:
            continue

    returned_count = len(actors)
    # Truncation is slice coverage (offset + limit), not returned count:
    # skipped (unserializable) actors must not read as another page.
    return {
        "world_name": world.get_name(),
        "total_actors": total_count,
        "actors": actors,
        "total_count": total_count,
        "returned_count": returned_count,
        "truncated": (page_offset + page_limit) < total_count,
        "limit": page_limit,
        "offset": page_offset,
    }


def main():
    limit = decode_template_json("""${limit}""")
    offset = decode_template_json("""${offset}""")
    fields = decode_template_json("""${fields}""")
    outliner_data = get_world_outliner(limit, offset, fields)
    print(json.dumps(outliner_data, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
