import json


def get_project_info():
    project_file_path = unreal.Paths.get_project_file_path()
    project_directory = unreal.Paths.project_dir()
    enabled_plugins = get_enabled_plugins()
    classic_input = get_classic_input_mappings()

    asset_registry = unreal.AssetRegistryHelpers.get_asset_registry()
    all_assets = asset_registry.get_all_assets()

    asset_locations = {}
    input_actions = []
    input_mappings = []
    game_modes = []
    characters = []
    experiences = []
    weapons = []
    maps = []

    for asset in all_assets:
        asset_name = str(asset.asset_name)
        asset_name_lower = asset_name.lower()
        package_path = str(asset.package_path)
        asset_class_name = get_asset_class_name(asset).lower()
        full_path = get_asset_object_path(asset) or "{0}/{1}".format(
            package_path, asset_name
        )

        location = package_path.split("/")[1] if "/" in package_path else "Root"
        asset_locations[location] = asset_locations.get(location, 0) + 1

        if asset_name.startswith("IA_"):
            input_actions.append(full_path)
        elif asset_name.startswith("IMC_"):
            input_mappings.append(full_path)

        if "gamemode" in asset_name_lower or asset_class_name in (
            "gamemode",
            "gamemodebase",
        ):
            game_modes.append(full_path)
        elif (
            any(term in asset_name_lower for term in ["hero", "character"])
            and "b_" in asset_name_lower
        ):
            characters.append(full_path)
        elif "experience" in asset_name_lower and "ui" not in package_path.lower():
            experiences.append(full_path)
        elif any(term in asset_name_lower for term in ["weapon", "wid_"]):
            weapons.append(full_path)
        elif asset_class_name == "world" or asset_name.startswith("L_"):
            maps.append(full_path)

    input_systems = []
    enhanced_input_enabled = (
        "enhancedinput" in enabled_plugins or len(input_actions) > 0 or len(input_mappings) > 0
    )
    classic_input_enabled = bool(
        classic_input["action_mappings"] or classic_input["axis_mappings"]
    )

    if enhanced_input_enabled:
        input_systems.append("enhanced_input")
    if classic_input_enabled:
        input_systems.append("classic_input")

    return {
        "project_name": project_file_path.split("/")[-1].replace(".uproject", "")
        if project_file_path
        else "Unknown",
        "project_directory": project_directory,
        "engine_version": unreal.SystemLibrary.get_engine_version(),
        "total_assets": len(all_assets),
        "asset_locations": dict(
            sorted(asset_locations.items(), key=lambda item: item[1], reverse=True)[:10]
        ),
        "enhanced_input_enabled": enhanced_input_enabled,
        "classic_input_enabled": classic_input_enabled,
        "input_systems": input_systems,
        "input_actions": input_actions[:10],
        "input_mappings": input_mappings[:10],
        "input_actions_count": len(input_actions),
        "input_mappings_count": len(input_mappings),
        "classic_input_actions": classic_input["action_mappings"],
        "classic_axis_mappings": classic_input["axis_mappings"],
        "classic_input_actions_count": len(classic_input["action_mappings"]),
        "classic_axis_mappings_count": len(classic_input["axis_mappings"]),
        "game_modes": game_modes[:5],
        "characters": characters[:5],
        "experiences": experiences[:5],
        "weapons": weapons[:10],
        "maps": maps[:10],
        "gameplay_ability_system": "gameplayabilities" in enabled_plugins,
        "modular_gameplay": "modulargameplay" in enabled_plugins,
        "python_scripting": True,
        "networking": True,
        "total_maps": len(maps),
        "total_weapons": len(weapons),
        "total_experiences": len(experiences),
    }


def main():
    project_data = get_project_info()
    print(json.dumps(project_data, indent=2))


if __name__ == "__main__":
    main()
