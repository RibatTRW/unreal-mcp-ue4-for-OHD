# SHIP-S3 bounded reads: server-side paging defaults for the uncapped
# actor list/find dumps. The TS paramsSchema (manage_actor.list/find,
# manage_level.list_actors) rejects negative / non-integer / over-max
# limit/offset before dispatch; the clamps below are defense-in-depth
# for direct run_python callers. Counts are taken before slicing so
# total_count stays honest, and only the page slice is serialized
# (slice before serialize).
DEFAULT_PAGE_LIMIT = 200
MAX_PAGE_LIMIT = 2000


def normalize_page_args(args):
    limit = args.get("limit")
    offset = args.get("offset")

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


def page_envelope(total_count, returned_count, page_limit, page_offset):
    # Truncation is slice coverage (offset + limit), not returned count:
    # skipped (unserializable) actors must not read as another page.
    return {
        "total_count": total_count,
        "returned_count": returned_count,
        "truncated": (page_offset + page_limit) < total_count,
        "limit": page_limit,
        "offset": page_offset,
    }


def get_actors_in_level(_args):
    world = get_editor_world()
    if not world:
        return {"success": False, "message": "No world loaded", "actors": []}

    args = _args or {}
    page_limit, page_offset = normalize_page_args(args)

    all_actors = get_all_level_actors()
    total_count = len(all_actors)

    # Cheap sort keys first so only the page slice pays for the full
    # per-actor summary serialization.
    keyed_actors = []
    for actor in all_actors:
        try:
            keyed_actors.append((actor.get_actor_label() or actor.get_name(), actor))
        except Exception:
            continue

    keyed_actors.sort(key=lambda entry: entry[0] or "")

    actors = []
    for _label, actor in keyed_actors[page_offset:page_offset + page_limit]:
        try:
            actors.append(get_actor_summary(actor))
        except Exception:
            continue

    result = {
        "success": True,
        "world_name": world.get_name(),
        "actors": actors,
    }
    result.update(page_envelope(total_count, len(actors), page_limit, page_offset))
    return result


def find_actors_by_name(args):
    pattern = unreal_text(args.get("pattern") or "").strip().lower()
    if not pattern:
        return {"success": False, "message": "Pattern is required", "actors": []}

    page_limit, page_offset = normalize_page_args(args)

    matching_actors = []
    for actor in get_all_level_actors():
        try:
            actor_name = actor.get_name()
            actor_label = actor.get_actor_label()
        except Exception:
            continue
        if pattern in (actor_name or "").lower() or pattern in (actor_label or "").lower():
            try:
                actor_class = actor.get_class().get_name()
            except Exception:
                actor_class = ""
            matching_actors.append((actor_label or actor_name, actor_name, actor_label, actor_class))

    matching_actors.sort(key=lambda entry: entry[0] or "")
    total_count = len(matching_actors)

    actors = []
    for _sort_key, actor_name, actor_label, actor_class in matching_actors[
        page_offset:page_offset + page_limit
    ]:
        actors.append(
            {
                "name": actor_name,
                "label": actor_label,
                "class": actor_class,
            }
        )

    result = {
        "success": True,
        "pattern": pattern,
        "count": total_count,
        "actors": actors,
    }
    result.update(page_envelope(total_count, len(actors), page_limit, page_offset))
    return result


def get_actor_properties(args):
    actor_name = args.get("name")
    actor = find_actor_by_name(actor_name)
    if not actor:
        return {
            "success": False,
            "message": "Actor not found: {0}".format(actor_name),
        }

    return {"success": True, "actor": get_actor_property_report(actor)}


def get_actor_material_info(args):
    actor_name = args.get("name")
    actor = find_actor_by_name(actor_name)
    if not actor:
        return {
            "success": False,
            "message": "Actor not found: {0}".format(actor_name),
        }

    return {"success": True, "materials": get_actor_material_report(actor)}
