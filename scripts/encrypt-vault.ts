// 私密文件加密脚本（pnpm vault）
//
// 把 private/ 目录下的 .txt 明文（已被 .gitignore 忽略，永远不会提交）
// 用你输入的解锁口令加密成 src/data/vault.json —— 仓库和网站上只有这份密文，
// /vault/ 页面在浏览器本地用同一个口令解密。
//
// 加密：AES-256-GCM；密钥 = PBKDF2-SHA256(口令, 随机 16 字节盐, 600000 次)；随机 12 字节 IV。
// 文件名和内容打包成一个整体加密，外人连存了几个文件、叫什么都看不到。
// 每次运行都会重新生成盐和 IV，旧密文作废。
//
// 口令来源：环境变量 VAULT_PASSWORD，否则在终端里输入两遍（不回显）。
// 口令不会被写到任何地方；忘了就只能用新口令重新加密。

import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const PRIVATE_DIR = "private";
const OUTPUT_FILE = "src/data/vault.json";
const ITERATIONS = 600_000;
const MIN_LENGTH = 12;

type VaultFile = { name: string; content: string };

// 终端里不回显地读一行（输入时显示 *）
function askHidden(question: string): Promise<string> {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
		});
		const output = rl as unknown as { _writeToOutput: (s: string) => void };
		let muted = false;
		output._writeToOutput = (s: string) => {
			if (!muted) process.stdout.write(s);
			else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
			else process.stdout.write("*".repeat(s.length));
		};
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer);
		});
		muted = true;
	});
}

async function getPassword(): Promise<string> {
	const fromEnv = process.env.VAULT_PASSWORD;
	if (fromEnv) return fromEnv;
	if (!process.stdin.isTTY) {
		throw new Error("没有可交互的终端：请在终端里运行，或设置环境变量 VAULT_PASSWORD");
	}
	const first = await askHidden("请输入解锁口令：");
	const second = await askHidden("再输入一遍确认：");
	if (first !== second) throw new Error("两次输入的口令不一致");
	return first;
}

async function readPrivateFiles(): Promise<VaultFile[]> {
	let names: string[];
	try {
		names = await fs.readdir(PRIVATE_DIR);
	} catch {
		throw new Error(`找不到 ${PRIVATE_DIR}/ 目录，请先创建并放入 .txt 文件`);
	}
	const txt = names.filter((n) => n.toLowerCase().endsWith(".txt")).sort();
	if (!txt.length) throw new Error(`${PRIVATE_DIR}/ 里没有 .txt 文件`);
	return Promise.all(
		txt.map(async (name) => ({
			name: name.replace(/\.txt$/i, ""),
			content: (await fs.readFile(path.join(PRIVATE_DIR, name), "utf-8")).replace(/\r\n/g, "\n"),
		})),
	);
}

async function main(): Promise<void> {
	const files = await readPrivateFiles();
	console.log(`🔐 找到 ${files.length} 个文件：${files.map((f) => f.name).join("、")}`);

	const password = await getPassword();
	if (password.length < MIN_LENGTH) {
		throw new Error(`口令至少 ${MIN_LENGTH} 位（建议 4 个以上随机词或 16 位以上），否则密文可能被离线暴力破解`);
	}

	const salt = randomBytes(16);
	const iv = randomBytes(12);
	const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const plaintext = Buffer.from(JSON.stringify(files), "utf-8");
	// 密文 = 加密数据 + 16 字节认证标签（与 WebCrypto 的 AES-GCM 输出格式一致）
	const data = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

	const vault = {
		v: 1,
		kdf: "PBKDF2-SHA256",
		iterations: ITERATIONS,
		salt: salt.toString("base64"),
		iv: iv.toString("base64"),
		data: data.toString("base64"),
	};
	await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(vault, null, "\t")}\n`);
	console.log(`✓ 已加密写入 ${OUTPUT_FILE}（只含密文，可以提交）。明文仍只在 ${PRIVATE_DIR}/，不会被提交。`);
}

main().catch((err) => {
	console.error(`❌ ${err instanceof Error ? err.message : err}`);
	process.exit(1);
});
