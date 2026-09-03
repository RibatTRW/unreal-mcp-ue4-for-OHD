import { z } from "zod"

export const vector2InputSchema = z.union([
	z.object({ x: z.number(), y: z.number() }),
	z.tuple([z.number(), z.number()]),
])

export const vector3InputSchema = z.union([
	z.object({ x: z.number(), y: z.number(), z: z.number() }),
	z.tuple([z.number(), z.number(), z.number()]),
])

export const rotatorInputSchema = z.union([
	z.object({ pitch: z.number(), yaw: z.number(), roll: z.number() }),
	z.tuple([z.number(), z.number(), z.number()]),
])

export const colorInputSchema = z.union([
	z.object({
		r: z.number(),
		g: z.number(),
		b: z.number(),
		a: z.number().optional(),
	}),
	z.tuple([z.number(), z.number(), z.number(), z.number()]),
])

export const recordSchema = z.record(z.any())
export const stringListSchema = z.array(z.string().min(1)).min(1)

export interface RegistrationSchemas {
	colorInputSchema: z.ZodTypeAny
	recordSchema: z.ZodRecord<z.ZodString, z.ZodAny>
	rotatorInputSchema: z.ZodTypeAny
	stringListSchema: z.ZodArray<z.ZodString, "many">
	vector2InputSchema: z.ZodTypeAny
	vector3InputSchema: z.ZodTypeAny
	worldBuildBaseSchema: {
		location: z.ZodTypeAny
		material_path: z.ZodTypeAny
		prefix: z.ZodTypeAny
	}
	toColorArray: (value?: unknown) => number[] | undefined
	toColorRecord: (value?: unknown) => { a: number; b: number; g: number; r: number } | undefined
	toRotatorArray: (value?: unknown) => number[] | undefined
	toRotatorRecord: (value?: unknown) => { pitch: number; roll: number; yaw: number } | undefined
	toVector2Array: (value?: unknown) => number[] | undefined
	toVector2Record: (value?: unknown) => { x: number; y: number } | undefined
	toVector3Array: (value?: unknown) => number[] | undefined
	toVector3Record: (value?: unknown) => { x: number; y: number; z: number } | undefined
}

export const worldBuildBaseSchema = {
	location: vector3InputSchema.optional().describe("Optional world location"),
	material_path: z.string().optional().describe("Optional material path to apply"),
	prefix: z.string().optional().describe("Optional actor label prefix"),
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const numberAt = (values: unknown[], index: number, fallback: number) => Number(values[index] ?? fallback)

const numberProp = (record: Record<string, unknown>, key: string, fallback: number) => Number(record[key] ?? fallback)

export function toVector2Record(value?: unknown) {
	if (!value) {
		return undefined
	}

	if (Array.isArray(value)) {
		return { x: numberAt(value, 0, 0), y: numberAt(value, 1, 0) }
	}

	if (!isRecord(value)) {
		return undefined
	}

	return { x: numberProp(value, "x", 0), y: numberProp(value, "y", 0) }
}

export function toVector3Record(value?: unknown) {
	if (!value) {
		return undefined
	}

	if (Array.isArray(value)) {
		return {
			x: numberAt(value, 0, 0),
			y: numberAt(value, 1, 0),
			z: numberAt(value, 2, 0),
		}
	}

	if (!isRecord(value)) {
		return undefined
	}

	return {
		x: numberProp(value, "x", 0),
		y: numberProp(value, "y", 0),
		z: numberProp(value, "z", 0),
	}
}

export function toRotatorRecord(value?: unknown) {
	if (!value) {
		return undefined
	}

	if (Array.isArray(value)) {
		return {
			pitch: numberAt(value, 0, 0),
			yaw: numberAt(value, 1, 0),
			roll: numberAt(value, 2, 0),
		}
	}

	if (!isRecord(value)) {
		return undefined
	}

	return {
		pitch: numberProp(value, "pitch", 0),
		yaw: numberProp(value, "yaw", 0),
		roll: numberProp(value, "roll", 0),
	}
}

export function toVector2Array(value?: unknown) {
	const vector = toVector2Record(value)
	return vector ? [vector.x, vector.y] : undefined
}

export function toVector3Array(value?: unknown) {
	const vector = toVector3Record(value)
	return vector ? [vector.x, vector.y, vector.z] : undefined
}

export function toRotatorArray(value?: unknown) {
	const rotator = toRotatorRecord(value)
	return rotator ? [rotator.pitch, rotator.yaw, rotator.roll] : undefined
}

export function toColorRecord(value?: unknown) {
	if (!value) {
		return undefined
	}

	if (Array.isArray(value)) {
		return {
			r: numberAt(value, 0, 0),
			g: numberAt(value, 1, 0),
			b: numberAt(value, 2, 0),
			a: numberAt(value, 3, 1),
		}
	}

	if (!isRecord(value)) {
		return undefined
	}

	return {
		r: numberProp(value, "r", 0),
		g: numberProp(value, "g", 0),
		b: numberProp(value, "b", 0),
		a: numberProp(value, "a", 1),
	}
}

export function toColorArray(value?: unknown) {
	const colorRecord = toColorRecord(value)
	return colorRecord ? [colorRecord.r, colorRecord.g, colorRecord.b, colorRecord.a] : undefined
}

export function createRegistrationSchemaHelpers(): RegistrationSchemas {
	return {
		colorInputSchema,
		recordSchema,
		rotatorInputSchema,
		stringListSchema,
		vector2InputSchema,
		vector3InputSchema,
		worldBuildBaseSchema,
		toColorArray,
		toColorRecord,
		toRotatorArray,
		toRotatorRecord,
		toVector2Array,
		toVector2Record,
		toVector3Array,
		toVector3Record,
	}
}
