def create_level_sequence(args):
    return _create_asset_via_factory(
        args.get("name") or args.get("asset_name"),
        args.get("path") or "/Game/Cinematics",
        "LevelSequenceFactoryNew",
        "LevelSequence",
        ["LevelSequence"],
        "LevelSequenceFactoryNew is not exposed in this UE4.25 Python environment.",
    )


def create_behavior_tree(args):
    return _create_asset_via_factory(
        args.get("name") or args.get("asset_name"),
        args.get("path") or "/Game/AI",
        "BehaviorTreeFactory",
        "BehaviorTree",
        ["AIModule"],
        "BehaviorTreeFactory is not exposed in this UE4.25 Python environment.",
    )
