/**
 * dsh-codex-moot-escalation — host half.
 *
 * Root cause being addressed: GPT/Codex models unconditionally emit every
 * top-level key of a tool schema, including the OPTIONAL escalation pair
 * `sandbox_permissions` + `justification` on bash/edit/write. DSH treats the
 * presence of `sandbox_permissions` as an escalation request and throws when
 * the requested mode is not STRICTLY wider than the session's effective mode.
 * At `danger-full-access` nothing is wider, so every call fails before running
 * ("sandbox escalation ... is not strictly wider"), making GPT unusable.
 *
 * This plugin strips those two fields from the tool schemas a Codex session at
 * `danger-full-access` is about to see, so the model never advertises an
 * escalation it cannot make. All other providers and all other modes are left
 * untouched (native behavior preserved).
 *
 * @module dsh-codex-moot-escalation
 */
export const name = 'dsh-codex-moot-escalation';
export const inject = [];

/** Remove the escalation pair from one tool schema's parameters. */
function strip(tool) {
	const params = tool && tool.parameters;
	if (!params || typeof params !== 'object') return tool;
	const props = params.properties;
	if (!props || typeof props !== 'object') return tool;
	const hasEscalation =
		Object.prototype.hasOwnProperty.call(props, 'sandbox_permissions') ||
		Object.prototype.hasOwnProperty.call(props, 'justification');
	if (!hasEscalation) return tool;
	const properties = { ...props };
	delete properties.sandbox_permissions;
	delete properties.justification;
	const required = Array.isArray(params.required)
		? params.required.filter((r) => r !== 'sandbox_permissions' && r !== 'justification')
		: params.required;
	const nextParams = { ...params, properties };
	if (required !== void 0) nextParams.required = required;
	return { ...tool, parameters: nextParams };
}

/** Resolve the provider route an agent is running under. */
function providerOf(agent) {
	if (agent && agent.options && agent.options.provider) return agent.options.provider;
	if (agent && agent.session && typeof agent.session.requestHeader === 'function') {
		const hdr = agent.session.requestHeader();
		if (hdr && hdr.config && hdr.config.provider) return hdr.config.provider;
	}
	return void 0;
}

export function apply(ctx) {
	ctx.on('system-prompt/assemble', async (assembly, context, next) => {
		const result = await next();
		const agent = context && context.agent;
		if (!agent) return result;
		// Blast-radius gate: only the Codex provider.
		if (providerOf(agent) !== 'codex') return result;
		// Only when the effective mode makes every escalation moot (nothing wider).
		const sp = ctx.get('sandboxPolicy');
		let mode;
		if (sp && typeof sp.resolve === 'function') {
			try {
				mode = sp.resolve({ session: agent.session }).mode;
			} catch (_e) {
				mode = void 0;
			}
		}
		if (mode !== 'danger-full-access') return result;
		if (!result.tools || !result.tools.length) return result;
		const tools = result.tools.map(strip);
		return { ...result, tools };
	});
}
