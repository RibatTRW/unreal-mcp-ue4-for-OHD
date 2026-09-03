def create_wall(args):
    prefix = args.get("prefix") or "Wall"
    location = args.get("location") or [0.0, 0.0, 150.0]
    actors = []

    _build_wall(
        actors,
        prefix,
        location,
        args.get("segments", 8),
        args.get("segment_length", 300.0),
        args.get("height", 300.0),
        args.get("thickness", 50.0),
        axis=unreal_text(args.get("axis") or "x").lower(),
        material_path=args.get("material_path"),
    )

    return _structure_result("create_wall", actors)


def create_staircase(args):
    prefix = args.get("prefix") or "Staircase"
    location = args.get("location") or [0.0, 0.0, 0.0]
    actors = []
    _build_staircase_geometry(
        actors,
        prefix,
        location,
        args.get("steps", 8),
        args.get("step_width", 250.0),
        args.get("step_height", 25.0),
        args.get("step_depth", 120.0),
        material_path=args.get("material_path"),
    )
    return _structure_result("create_staircase", actors)


def create_arch(args):
    prefix = args.get("prefix") or "Arch"
    location = args.get("location") or [0.0, 0.0, 0.0]
    actors = []
    _build_arch_geometry(
        actors,
        prefix,
        location,
        args.get("span_width", 400.0),
        args.get("pillar_height", 350.0),
        args.get("pillar_width", 60.0),
        args.get("beam_height", 60.0),
        material_path=args.get("material_path"),
    )
    return _structure_result("create_arch", actors)


def create_tower(args):
    prefix = args.get("prefix") or "Tower"
    location = args.get("location") or [0.0, 0.0, 0.0]
    actors = []
    _build_tower_geometry(
        actors,
        prefix,
        location,
        args.get("width", 300.0),
        args.get("floors", 5),
        args.get("floor_height", 220.0),
        material_path=args.get("material_path"),
    )
    return _structure_result("create_tower", actors)


def construct_house(args):
    prefix = args.get("prefix") or "House"
    location = args.get("location") or [0.0, 0.0, 0.0]
    actors = []
    _build_house_geometry(
        actors,
        prefix,
        location,
        args.get("width", 500.0),
        args.get("depth", 400.0),
        args.get("wall_height", 260.0),
        args.get("wall_thickness", 35.0),
        args.get("roof_height", 80.0),
        material_path=args.get("material_path"),
    )
    return _structure_result("construct_house", actors)


def construct_mansion(args):
    prefix = args.get("prefix") or "Mansion"
    location = args.get("location") or [0.0, 0.0, 0.0]
    actors = []
    _build_house_geometry(
        actors,
        "{0}_Main".format(prefix),
        location,
        args.get("width", 900.0),
        args.get("depth", 650.0),
        args.get("wall_height", 320.0),
        args.get("wall_thickness", 40.0),
        args.get("roof_height", 100.0),
        material_path=args.get("material_path"),
    )
    wing_offset = float(args.get("wing_offset", 650.0))
    for side, offset in (("L", -wing_offset), ("R", wing_offset)):
        _build_house_geometry(
            actors,
            "{0}_Wing_{1}".format(prefix, side),
            [float(location[0]) + offset, float(location[1]), float(location[2])],
            450.0,
            350.0,
            260.0,
            35.0,
            80.0,
            material_path=args.get("material_path"),
        )
    _build_staircase_geometry(
        actors,
        "{0}_FrontSteps".format(prefix),
        [float(location[0]) + 350.0, float(location[1]), float(location[2]) - 20.0],
        6,
        320.0,
        20.0,
        90.0,
        material_path=args.get("material_path"),
    )
    return _structure_result("construct_mansion", actors)


def create_town(args):
    prefix = args.get("prefix") or "Town"
    origin = args.get("location") or [0.0, 0.0, 0.0]
    rows = int(args.get("rows", 2))
    cols = int(args.get("cols", 3))
    spacing = float(args.get("spacing", 1200.0))
    actors = []

    for row in range(rows):
        for col in range(cols):
            house_location = [
                float(origin[0]) + row * spacing,
                float(origin[1]) + col * spacing,
                float(origin[2]),
            ]
            _build_house_geometry(
                actors,
                "{0}_House_{1}_{2}".format(prefix, row, col),
                house_location,
                500.0,
                400.0,
                260.0,
                35.0,
                70.0,
                material_path=args.get("material_path"),
            )

    _build_tower_geometry(
        actors,
        "{0}_CenterTower".format(prefix),
        [
            float(origin[0]) + (rows - 1) * spacing / 2.0,
            float(origin[1]) + (cols - 1) * spacing / 2.0,
            float(origin[2]),
        ],
        320.0,
        6,
        220.0,
        material_path=args.get("material_path"),
    )
    return _structure_result("create_town", actors, {"rows": rows, "cols": cols})
