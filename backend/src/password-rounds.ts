export function readBcryptRounds(raw: string | undefined): number {
	const rounds = Number(raw ?? 12);

	if (!Number.isInteger(rounds) || rounds < 4 || rounds > 31) {
		throw new Error('BCRYPT_ROUNDS must be an integer between 4 and 31');
	}

	return rounds;
}
