import { contentAssetDescriptors } from "./register-content-asset-namespaces.js"
import { contentBlueprintDescriptors } from "./register-content-blueprint-namespaces.js"
import { contentMediaDescriptors } from "./register-content-media-namespaces.js"
import { contentWidgetDescriptors } from "./register-content-widget-namespaces.js"
import { coreAssetActorDescriptors } from "./register-core-asset-actor-namespaces.js"
import { coreEditorDescriptors } from "./register-core-editor-namespaces.js"
import { coreInspectionDescriptors } from "./register-core-inspection-namespaces.js"
import { coreSourceControlDescriptors } from "./register-core-source-control-namespaces.js"
import { coreSystemDescriptors } from "./register-core-system-namespaces.js"
import { coreToolsDescriptors } from "./register-core-tools-namespaces.js"
import { gameplayDescriptors } from "./register-gameplay-namespaces.js"
import { worldBuildingDescriptors } from "./register-world-building-namespaces.js"
import { worldEffectsSplineDescriptors } from "./register-world-effects-splines-namespaces.js"
import { worldLightingDescriptors } from "./register-world-lighting-namespaces.js"
import { worldNavigationVolumeDescriptors } from "./register-world-navigation-volume-namespaces.js"
import type {
	NamespaceActionRegistration,
	RegistrationDispatch,
	RegistrationParams,
	RegistrationSchemas,
} from "./registration-context.js"

export interface ToolNamespaceDescriptor {
	name: string
	description: string
	actions: Record<string, NamespaceActionRegistration>
	options?: { compactParamsSchema?: boolean }
}

export type FullRegistrationFacades = RegistrationParams & RegistrationSchemas & RegistrationDispatch

export type ToolNamespaceBuilder = (ctx: FullRegistrationFacades) => ToolNamespaceDescriptor[]

export function registerToolNamespaceDescriptors(ctx: FullRegistrationFacades, builders: ToolNamespaceBuilder[]): void {
	const seen = new Set<string>()
	for (const build of builders) {
		for (const descriptor of build(ctx)) {
			if (seen.has(descriptor.name)) {
				throw new Error(`Duplicate tool namespace: ${descriptor.name}`)
			}
			seen.add(descriptor.name)
			ctx.registerToolNamespace(descriptor.name, descriptor.description, descriptor.actions, descriptor.options)
		}
	}
}

export function registerAllToolNamespaces(ctx: FullRegistrationFacades): void {
	registerToolNamespaceDescriptors(ctx, [
		coreAssetActorDescriptors,
		coreEditorDescriptors,
		coreSystemDescriptors,
		coreInspectionDescriptors,
		coreToolsDescriptors,
		coreSourceControlDescriptors,
		worldLightingDescriptors,
		worldNavigationVolumeDescriptors,
		worldEffectsSplineDescriptors,
		worldBuildingDescriptors,
		contentAssetDescriptors,
		contentBlueprintDescriptors,
		contentWidgetDescriptors,
		contentMediaDescriptors,
		gameplayDescriptors,
	])
}
