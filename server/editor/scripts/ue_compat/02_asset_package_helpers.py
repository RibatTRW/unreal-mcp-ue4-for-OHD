def get_asset_class_name(asset_or_data):
    try:
        if hasattr(asset_or_data, "asset_class_path"):
            asset_class_path = asset_or_data.asset_class_path
            if hasattr(asset_class_path, "asset_name"):
                return unreal_text(asset_class_path.asset_name)
            return unreal_text(asset_class_path)
    except Exception:
        pass

    try:
        if hasattr(asset_or_data, "asset_class"):
            return unreal_text(asset_or_data.asset_class)
    except Exception:
        pass

    try:
        asset_class = asset_or_data.get_class()
        if asset_class:
            return unreal_text(asset_class.get_name())
    except Exception:
        pass

    return ""


def get_asset_object_path(asset_or_data):
    try:
        if hasattr(asset_or_data, "object_path"):
            return unreal_text(asset_or_data.object_path)
    except Exception:
        pass

    try:
        return unreal_text(asset_or_data.get_path_name())
    except Exception:
        return ""


def normalize_asset_reference_path(path_value):
    if not path_value:
        return ""

    normalized = unreal_text(path_value).strip()
    if not normalized:
        return ""

    if ":" in normalized:
        normalized = normalized.split(":", 1)[0]

    if "." in normalized:
        package_name, object_name = normalized.rsplit(".", 1)
        if package_name.rsplit("/", 1)[-1] == object_name:
            return package_name

    return normalized


def get_asset_package_name(asset_or_data):
    candidates = []

    try:
        package = asset_or_data.get_package()
        if package:
            normalized_package_name = normalize_asset_reference_path(package.get_name())
            if normalized_package_name:
                candidates.append(normalized_package_name)
    except Exception:
        pass

    try:
        if hasattr(asset_or_data, "package_name"):
            normalized_package_name = normalize_asset_reference_path(
                asset_or_data.package_name
            )
            if normalized_package_name:
                candidates.append(normalized_package_name)
    except Exception:
        pass

    try:
        object_path = normalize_asset_reference_path(get_asset_object_path(asset_or_data))
        if object_path:
            candidates.append(object_path)
    except Exception:
        pass

    if candidates:
        return max(candidates, key=len)

    return ""


def get_asset_package_path(asset_or_data):
    try:
        if hasattr(asset_or_data, "package_path"):
            return unreal_text(asset_or_data.package_path)
    except Exception:
        pass

    package_name = get_asset_package_name(asset_or_data)
    if "/" in package_name:
        return package_name.rsplit("/", 1)[0]
    return package_name


def get_asset_data_tag_value(asset_data, tag_name):
    try:
        value = asset_data.get_tag_value(tag_name)
        if isinstance(value, tuple):
            if len(value) == 2 and value[0]:
                return value[1]
            return None
        return value
    except Exception:
        return None


def get_static_mesh_lod_info(static_mesh):
    lod_levels = []

    try:
        if hasattr(unreal, "EditorStaticMeshLibrary"):
            lod_count = unreal.EditorStaticMeshLibrary.get_lod_count(static_mesh)
            for lod_index in range(max(lod_count, 0)):
                lod_info = {"lod_index": lod_index}

                try:
                    lod_info["num_vertices"] = unreal.EditorStaticMeshLibrary.get_number_verts(
                        static_mesh, lod_index
                    )
                except Exception:
                    pass

                try:
                    if hasattr(static_mesh, "get_num_triangles"):
                        lod_info["num_triangles"] = static_mesh.get_num_triangles(
                            lod_index
                        )
                except Exception:
                    pass

                lod_levels.append(lod_info)

            return lod_levels
    except Exception:
        pass

    try:
        if hasattr(static_mesh, "get_num_lods"):
            for lod_index in range(static_mesh.get_num_lods()):
                lod_levels.append({"lod_index": lod_index})
    except Exception:
        pass

    return lod_levels


def get_skeletal_mesh_lod_info(skeletal_mesh):
    lod_levels = []

    try:
        if hasattr(unreal, "EditorSkeletalMeshLibrary"):
            lod_count = unreal.EditorSkeletalMeshLibrary.get_lod_count(skeletal_mesh)
            for lod_index in range(max(lod_count, 0)):
                lod_info = {"lod_index": lod_index}

                try:
                    lod_info["num_vertices"] = unreal.EditorSkeletalMeshLibrary.get_num_verts(
                        skeletal_mesh, lod_index
                    )
                except Exception:
                    pass

                try:
                    lod_info["num_sections"] = unreal.EditorSkeletalMeshLibrary.get_num_sections(
                        skeletal_mesh, lod_index
                    )
                except Exception:
                    pass

                lod_levels.append(lod_info)

            return lod_levels
    except Exception:
        pass

    try:
        if hasattr(skeletal_mesh, "get_lod_num"):
            for lod_index in range(skeletal_mesh.get_lod_num()):
                lod_levels.append({"lod_index": lod_index})
    except Exception:
        pass

    return lod_levels
