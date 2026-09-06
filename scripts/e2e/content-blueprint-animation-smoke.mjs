import { runContentAnimationPhysicsScenarios } from "./content-animation-physics-smoke.mjs"
import { runContentBlueprintAuthoringScenarios } from "./content-blueprint-authoring-smoke.mjs"

export async function runContentBlueprintAnimationScenarios(state) {
	const { options, addCleanup, safeDeleteActor } = state

	state.blueprintActorName = `${options.prefix}_BlueprintActor`
	state.physicsBlueprintActorName = `${options.prefix}_PhysicsBlueprintActor`

	addCleanup(`Delete actor ${state.blueprintActorName}`, () => safeDeleteActor(state.blueprintActorName))
	addCleanup(`Delete actor ${state.physicsBlueprintActorName}`, () => safeDeleteActor(state.physicsBlueprintActorName))

	await runContentBlueprintAuthoringScenarios(state)
	await runContentAnimationPhysicsScenarios(state)
}
