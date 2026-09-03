import unreal
import json


def move_viewport_camera(location, rotation):
    try:
        location_vector = unreal.Vector(
            x=location["x"], y=location["y"], z=location["z"]
        )
        rotation_rotator = unreal.Rotator(
            pitch=rotation["pitch"], yaw=rotation["yaw"], roll=rotation["roll"]
        )

        unreal.EditorLevelLibrary.set_level_viewport_camera_info(
            location_vector, rotation_rotator
        )

        return {
            "success": True,
            "location": {
                "x": location["x"],
                "y": location["y"],
                "z": location["z"],
            },
            "rotation": {
                "pitch": rotation["pitch"],
                "yaw": rotation["yaw"],
                "roll": rotation["roll"],
            },
        }

    except Exception as e:
        return {"success": False, "error": unreal_text(e)}


try:
    location_data = decode_template_arg("location", """${location}""")
    rotation_data = decode_template_arg("rotation", """${rotation}""")
except ArgDecodeError as exc:
    print(json.dumps(arg_decode_failure(exc.arg_name)))
else:
    if location_data and rotation_data:
        result = move_viewport_camera(location_data, rotation_data)
        print(json.dumps(result))
    else:
        print(
            json.dumps(
                {"success": False, "error": "Location and rotation parameters are required"}
            )
        )
