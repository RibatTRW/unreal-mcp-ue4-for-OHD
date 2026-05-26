import { z } from "zod"

import {
	assetLookupSchema,
	requireAtLeastOneValue,
	searchAssetsShape,
} from "./namespace-action-schema-fragments.js"
import { RegistrationContext } from "./registration-context.js"

export function registerContentMediaNamespaces(ctx: RegistrationContext) {
	const {
		editorTools,
		optionalStringParam,
		pythonDispatch,
		registerToolNamespace,
		requiredStringParam,
		searchAssetsCommand,
	} = ctx

	const sequenceAssetShape = {
		sequence_path: z.string().optional(),
		asset_path: z.string().optional(),
		path: z.string().optional(),
		name: z.string().optional(),
	}
	const sequenceParamsSchema = (shape: z.ZodRawShape = {}) =>
		requireAtLeastOneValue(
			z.object({ ...sequenceAssetShape, ...shape }).strict(),
			["sequence_path", "asset_path", "path", "name"],
			"Provide sequence_path, asset_path, path, or name.",
		)
	const sequenceParamsWithOneValue = (shape: z.ZodRawShape, keys: string[], message: string) =>
		requireAtLeastOneValue(sequenceParamsSchema(shape), keys, message)
	const sequenceRangeShape = {
		start_frame: z.number().optional(),
		end_frame: z.number().optional(),
		duration_frames: z.number().optional(),
		start_seconds: z.number().optional(),
		end_seconds: z.number().optional(),
		duration_seconds: z.number().optional(),
		unbounded: z.boolean().optional(),
		save: z.boolean().optional(),
	}
	const sequenceBindingTargetShape = {
		binding_id: z.string().optional(),
		binding_name: z.string().optional(),
		actor_name: z.string().optional(),
		actor_path: z.string().optional(),
		object_path: z.string().optional(),
		camera_actor_name: z.string().optional(),
	}
	const sequenceTrackTargetShape = {
		scope: z.enum(["master", "binding"]).optional(),
		master: z.boolean().optional(),
		track_type: z.string().optional(),
		track_index: z.number().optional(),
		track_name: z.string().optional(),
		...sequenceBindingTargetShape,
	}

	registerToolNamespace("manage_sequence", ctx.toolDescription("manage_sequence"), {
		sequence_support: {
			description: "Report whether the UE4.27 SequencerScripting APIs needed by advanced sequence actions are available.",
			paramsSchema: z.object({}).strict(),
			handler: () => pythonDispatch(editorTools.UESequenceTool("sequence_support")),
		},
		create_sequence: {
			description: "Create a LevelSequence asset.",
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						name: z.string().optional(),
						asset_name: z.string().optional(),
						path: z.string().optional(),
					})
					.strict(),
				["name", "asset_name"],
				"Provide name or asset_name.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEContentFactoryTool("create_level_sequence", {
						name: requiredStringParam(params, ["name", "asset_name"]),
						path: optionalStringParam(params, ["path"]),
					}),
				),
		},
		search_sequences: {
			description: "Search LevelSequence assets.",
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "LevelSequence")),
		},
		sequence_info: {
			description: "Read basic LevelSequence asset metadata.",
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
		inspect_sequence: {
			description: "Inspect playback range, rates, master tracks, bindings, sections, channels, and optionally keys.",
			paramsSchema: sequenceParamsSchema({
				include_channels: z.boolean().optional(),
				include_keys: z.boolean().optional(),
				key_limit: z.number().optional(),
			}),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("inspect_sequence", params)),
		},
		set_playback_range: {
			description: "Set the LevelSequence playback start or end in display frames or seconds.",
			paramsSchema: sequenceParamsSchema(sequenceRangeShape),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("set_playback_range", params)),
		},
		convert_time: {
			description: "Convert between seconds, display frames, and tick-resolution frames for a LevelSequence.",
			paramsSchema: sequenceParamsWithOneValue(
				{
					seconds: z.number().optional(),
					display_frame: z.number().optional(),
					tick_frame: z.number().optional(),
					frame: z.number().optional(),
				},
				["seconds", "display_frame", "tick_frame", "frame"],
				"Provide seconds, display_frame, tick_frame, or frame.",
			),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("convert_time", params)),
		},
		bind_actor: {
			description: "Add an actor from the current level as a possessable binding in a LevelSequence.",
			paramsSchema: sequenceParamsWithOneValue(
				{
					actor_name: z.string().optional(),
					actor_path: z.string().optional(),
					object_path: z.string().optional(),
					binding_name: z.string().optional(),
					reuse_existing: z.boolean().optional(),
					save: z.boolean().optional(),
				},
				["actor_name", "actor_path", "object_path"],
				"Provide actor_name, actor_path, or object_path.",
			),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("bind_actor", params)),
		},
		add_track: {
			description: "Add a master track or binding track, optionally setting a property path and creating an initial section.",
			paramsSchema: sequenceParamsSchema({
				...sequenceTrackTargetShape,
				...sequenceRangeShape,
				track_type: z.string(),
				display_name: z.string().optional(),
				property_name: z.string().optional(),
				property_path: z.string().optional(),
				add_section: z.boolean().optional(),
			}),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("add_track", params)),
		},
		add_section: {
			description: "Add a section to an existing Sequencer track.",
			paramsSchema: sequenceParamsSchema({
				...sequenceTrackTargetShape,
				...sequenceRangeShape,
			}),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("add_section", params)),
		},
		add_key: {
			description: "Add a key to a section channel, including transform, float, bool, integer, byte, and string channels.",
			paramsSchema: sequenceParamsWithOneValue(
				{
					...sequenceTrackTargetShape,
					section_index: z.number().optional(),
					channel_type: z.string().optional(),
					channel_name: z.string().optional(),
					channel_index: z.number().optional(),
					frame: z.number().optional(),
					time_seconds: z.number().optional(),
					seconds: z.number().optional(),
					sub_frame: z.number().optional(),
					time_unit: z.enum(["display_rate", "tick_resolution"]).optional(),
					value: z.any().optional(),
					save: z.boolean().optional(),
				},
				["frame", "time_seconds", "seconds"],
				"Provide frame, time_seconds, or seconds.",
			).superRefine((params, refineCtx) => {
				if (params.value === undefined) {
					refineCtx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Provide value.",
					})
				}
			}),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("add_key", params)),
		},
		add_camera_cut: {
			description: "Add a camera cut section that targets an existing camera binding or binds a camera actor first.",
			paramsSchema: sequenceParamsWithOneValue(
				{
					...sequenceBindingTargetShape,
					...sequenceRangeShape,
				},
				["binding_id", "binding_name", "actor_name", "actor_path", "object_path", "camera_actor_name"],
				"Provide binding_id, binding_name, actor_name, actor_path, object_path, or camera_actor_name.",
			),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("add_camera_cut", params)),
		},
		analyze_playback_speed: {
			description: "Inspect MovieSceneSlomoTrack or time-dilation/play-rate-looking tracks and list their speed keys.",
			paramsSchema: sequenceParamsSchema({
				target_seconds: z.number().optional(),
				target_frame: z.number().optional(),
				start_seconds: z.number().optional(),
				integration_mode: z.enum(["linear", "constant"]).optional(),
			}),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("analyze_playback_speed", params)),
		},
		calculate_playback_time: {
			description: "Integrate speed-track keys to estimate adjusted real playback time for a target sequence frame or second.",
			paramsSchema: sequenceParamsWithOneValue(
				{
					target_seconds: z.number().optional(),
					target_frame: z.number().optional(),
					end_seconds: z.number().optional(),
					end_frame: z.number().optional(),
					start_seconds: z.number().optional(),
					integration_mode: z.enum(["linear", "constant"]).optional(),
				},
				["target_seconds", "target_frame", "end_seconds", "end_frame"],
				"Provide target_seconds, target_frame, end_seconds, or end_frame.",
			),
			handler: (params) => pythonDispatch(editorTools.UESequenceTool("calculate_playback_time", params)),
		},
	})

	registerToolNamespace("manage_audio", ctx.toolDescription("manage_audio"), {
		import_audio: {
			paramsSchema: requireAtLeastOneValue(
				z
					.object({
						source_file: z.string().optional(),
						file_path: z.string().optional(),
						local_path: z.string().optional(),
						destination_path: z.string().optional(),
						content_path: z.string().optional(),
						path: z.string().optional(),
						asset_name: z.string().optional(),
						name: z.string().optional(),
						replace_existing: z.boolean().optional(),
						save: z.boolean().optional(),
						auto_create_cue: z.boolean().optional(),
						cue_suffix: z.string().optional(),
					})
					.strict(),
				["source_file", "file_path", "local_path"],
				"Provide source_file, file_path, or local_path.",
			),
			handler: (params) =>
				pythonDispatch(
					editorTools.UEContentFactoryTool("import_audio", {
						source_file: requiredStringParam(params, ["source_file", "file_path", "local_path"]),
						destination_path: optionalStringParam(params, [
							"destination_path",
							"content_path",
							"path",
						]),
						asset_name: optionalStringParam(params, ["asset_name", "name"]),
						replace_existing:
							typeof params.replace_existing === "boolean" ? params.replace_existing : true,
						save: typeof params.save === "boolean" ? params.save : true,
						auto_create_cue:
							typeof params.auto_create_cue === "boolean" ? params.auto_create_cue : true,
						cue_suffix: optionalStringParam(params, ["cue_suffix"]),
					}),
				),
		},
		search_audio_assets: {
			paramsSchema: z.object(searchAssetsShape).strict(),
			handler: (params) => pythonDispatch(searchAssetsCommand(params, "SoundCue")),
		},
		audio_info: {
			paramsSchema: assetLookupSchema,
			handler: (params) =>
				pythonDispatch(
					editorTools.UEGetAssetInfo(requiredStringParam(params, ["asset_path", "path", "name"])),
				),
		},
	})
}
