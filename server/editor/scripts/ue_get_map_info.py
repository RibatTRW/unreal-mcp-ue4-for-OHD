import json


def get_map_info():
    world = get_editor_world()
    if not world:
        return {"error": "No world loaded"}

    all_actors = get_all_level_actors()
    actor_types = {}
    for actor in all_actors:
        try:
            actor_class = actor.get_class().get_name()
            actor_types[actor_class] = actor_types.get(actor_class, 0) + 1
        except Exception:
            continue

    streaming_level_names = get_streaming_level_names(world)

    return {
        "map_name": world.get_name(),
        "map_path": world.get_path_name(),
        "total_actors": len(all_actors),
        "actor_types": dict(
            sorted(actor_types.items(), key=lambda item: item[1], reverse=True)[:15]
        ),
        "lighting": {
            "has_lightmass_importance_volume": any(
                actor.get_class().get_name() == "LightmassImportanceVolume"
                for actor in all_actors
            ),
            "directional_lights": sum(
                1
                for actor in all_actors
                if actor.get_class().get_name() == "DirectionalLight"
            ),
            "point_lights": sum(
                1 for actor in all_actors if actor.get_class().get_name() == "PointLight"
            ),
            "spot_lights": sum(
                1 for actor in all_actors if actor.get_class().get_name() == "SpotLight"
            ),
        },
        "streaming_levels": len(streaming_level_names),
        "streaming_level_names": streaming_level_names,
    }


def main():
    map_data = get_map_info()
    print(json.dumps(map_data, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
