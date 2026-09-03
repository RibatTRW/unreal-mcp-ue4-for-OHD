def get_object_name(target):
    if target is None:
        return ""

    try:
        return unreal_text(target.get_name())
    except Exception:
        return unreal_text(target)


def get_object_class_name(target):
    if target is None:
        return ""

    try:
        target_class = target.get_class()
        if target_class:
            return unreal_text(target_class.get_name())
    except Exception:
        pass

    return ""


def resolve_class_reference(class_name, module_hints=None):
    if not class_name:
        return None

    if not isinstance(class_name, _string_types):
        return class_name

    try:
        if hasattr(unreal, class_name):
            return getattr(unreal, class_name)
    except Exception:
        pass

    candidate_paths = []
    if class_name.startswith("/Script/"):
        candidate_paths.append(class_name)
    else:
        for module_name in module_hints or []:
            candidate_paths.append("/Script/{0}.{1}".format(module_name, class_name))
        candidate_paths.append(class_name)

    for candidate_path in candidate_paths:
        try:
            resolved_class = unreal.load_class(None, candidate_path)
            if resolved_class:
                return resolved_class
        except Exception:
            continue

    return None


def get_asset_registry():
    return unreal.AssetRegistryHelpers.get_asset_registry()


def asset_class_matches(asset_class_name, allowed_class_names=None):
    if not allowed_class_names:
        return True

    asset_class_name_lower = unreal_text(asset_class_name).lower()
    for allowed_class_name in allowed_class_names:
        allowed_lower = unreal_text(allowed_class_name).lower()
        if (
            asset_class_name_lower == allowed_lower
            or asset_class_name_lower.endswith(allowed_lower)
            or allowed_lower in asset_class_name_lower
        ):
            return True
    return False


def find_asset_candidates(identifier, allowed_class_names=None):
    if not identifier:
        return []

    identifier_lower = unreal_text(identifier).lower()
    asset_registry = get_asset_registry()
    matches = []

    for asset_data in asset_registry.get_all_assets():
        asset_name = unreal_text(asset_data.asset_name)
        object_path = get_asset_object_path(asset_data)
        package_name = get_asset_package_name(asset_data)
        package_path = get_asset_package_path(asset_data)
        asset_class_name = get_asset_class_name(asset_data)

        if not asset_class_matches(asset_class_name, allowed_class_names):
            continue

        if identifier_lower.startswith("/"):
            match = (
                identifier_lower == object_path.lower()
                or identifier_lower == package_name.lower()
                or identifier_lower == package_path.lower()
                or identifier_lower == "{0}.{1}".format(package_name, asset_name).lower()
            )
        else:
            match = (
                identifier_lower == asset_name.lower()
                or identifier_lower == package_name.lower()
                or identifier_lower == object_path.lower()
                or identifier_lower == package_path.lower()
            )

        if not match:
            continue

        matches.append(
            {
                "asset_name": asset_name,
                "object_path": object_path,
                "package_name": package_name,
                "package_path": package_path,
                "class_name": asset_class_name,
            }
        )

    matches.sort(
        key=lambda asset_info: (
            asset_info["asset_name"].lower() != identifier_lower,
            asset_info["package_name"].lower() != identifier_lower,
            asset_info["object_path"].lower() != identifier_lower,
            asset_info["package_name"],
        )
    )
    return matches


def load_asset_by_identifier(identifier, allowed_class_names=None):
    if not identifier:
        raise ValueError("Asset identifier is required")

    direct_candidates = [identifier]
    if isinstance(identifier, _string_types) and identifier.startswith("/") and "." not in identifier.rsplit("/", 1)[-1]:
        direct_candidates.append(
            "{0}.{1}".format(identifier, identifier.rsplit("/", 1)[-1])
        )

    for candidate in direct_candidates:
        try:
            asset = unreal.EditorAssetLibrary.load_asset(candidate)
            if asset:
                asset_class_name = get_object_class_name(asset)
                if asset_class_matches(asset_class_name, allowed_class_names):
                    return asset
        except Exception:
            continue

    asset_candidates = find_asset_candidates(identifier, allowed_class_names)
    for asset_candidate in asset_candidates:
        for candidate in (
            asset_candidate["object_path"],
            asset_candidate["package_name"],
        ):
            try:
                asset = unreal.EditorAssetLibrary.load_asset(candidate)
                if asset:
                    return asset
            except Exception:
                continue

    raise ValueError("Asset not found: {0}".format(identifier))


def load_blueprint_asset(blueprint_name_or_path, allow_widget=False):
    allowed_class_names = ["Blueprint", "BlueprintGeneratedClass"]
    if allow_widget:
        allowed_class_names.extend(["WidgetBlueprint", "BaseWidgetBlueprint"])

    blueprint_asset = load_asset_by_identifier(
        blueprint_name_or_path, allowed_class_names
    )
    blueprint_class_name = get_object_class_name(blueprint_asset)

    if blueprint_class_name.endswith("WidgetBlueprint") and not allow_widget:
        raise ValueError(
            "Expected a non-widget blueprint, but got widget blueprint: {0}".format(
                blueprint_name_or_path
            )
        )

    return blueprint_asset


def get_asset_package_path_for_create(content_path):
    if not content_path:
        return "/Game"

    normalized = unreal_text(content_path).strip()
    if not normalized.startswith("/"):
        normalized = "/Game/{0}".format(normalized.strip("/"))

    return normalized.rstrip("/")


def split_asset_name_and_path(asset_name, default_path):
    if not asset_name:
        raise ValueError("Asset name is required")

    normalized = unreal_text(asset_name).strip()
    if normalized.startswith("/"):
        package_path, leaf_name = normalized.rsplit("/", 1)
        return leaf_name, package_path

    return normalized, get_asset_package_path_for_create(default_path)


def create_asset_with_factory(asset_name, package_path, asset_class, factory):
    asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
    return asset_tools.create_asset(
        asset_name,
        package_path,
        get_UClass(asset_class),
        factory,
    )
