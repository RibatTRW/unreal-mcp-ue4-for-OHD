def get_project_descriptor():
    project_file_path = unreal.Paths.get_project_file_path()
    if not project_file_path:
        return {}

    try:
        with io.open(project_file_path, encoding="utf-8") as project_file:
            return json.load(project_file)
    except Exception:
        return {}


def get_enabled_plugins():
    descriptor = get_project_descriptor()
    enabled_plugins = set()

    for plugin in descriptor.get("Plugins", []):
        try:
            if plugin.get("Enabled", True):
                name = plugin.get("Name")
                if name:
                    enabled_plugins.add(name.lower())
        except Exception:
            continue

    return enabled_plugins


_ACTION_NAME_RE = re.compile(r'ActionName="?([^",)]+)"?')
_AXIS_NAME_RE = re.compile(r'AxisName="?([^",)]+)"?')


def _extract_ini_names(ini_paths, pattern):
    values = []
    seen = set()

    for ini_path in ini_paths:
        if not os.path.exists(ini_path):
            continue

        try:
            with io.open(ini_path, encoding="utf-8", errors="ignore") as ini_file:
                ini_lines = ini_file.read().splitlines()
        except Exception:
            continue

        for line in ini_lines:
            stripped = line.strip()
            if not stripped or stripped[0] in ";#":
                continue

            match = pattern.search(stripped)
            if not match:
                continue

            value = match.group(1).strip()
            if value and value not in seen:
                seen.add(value)
                values.append(value)

    return values


def get_classic_input_mappings():
    project_dir = unreal.Paths.project_dir()
    ini_paths = [
        os.path.join(project_dir, "Config", "DefaultInput.ini"),
        os.path.join(project_dir, "Config", "Input.ini"),
    ]

    return {
        "action_mappings": _extract_ini_names(ini_paths, _ACTION_NAME_RE),
        "axis_mappings": _extract_ini_names(ini_paths, _AXIS_NAME_RE),
    }
