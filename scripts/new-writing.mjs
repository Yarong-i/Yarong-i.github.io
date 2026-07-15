import { access, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = createInterface({ input, output });
const writingsDirectory = resolve('src/content/writings');
const categories = new Set(['poetry', 'prose', 'fragment']);

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const yamlString = (value) => JSON.stringify(value);

async function askRequired(prompt) {
  while (true) {
    const value = (await rl.question(prompt)).trim();
    if (value) return value;
    output.write('값을 입력해 주세요.\n');
  }
}

async function askSlug() {
  while (true) {
    const slug = (await rl.question('Filename / slug: ')).trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      output.write('slug는 소문자 영문, 숫자, 하이픈만 사용할 수 있습니다.\n');
      continue;
    }

    const path = resolve(writingsDirectory, `${slug}.md`);
    try {
      await access(path, constants.F_OK);
      throw new Error(`이미 존재하는 파일입니다: src/content/writings/${slug}.md`);
    } catch (error) {
      if (error?.code === 'ENOENT') return { slug, path };
      throw error;
    }
  }
}

async function askWrittenAt() {
  while (true) {
    const value = (await rl.question('Written date (YYYY-MM-DD, optional): ')).trim();
    if (!value || isValidDate(value)) return value;
    output.write('실제 존재하는 YYYY-MM-DD 형식의 날짜를 입력해 주세요.\n');
  }
}

async function askCategory() {
  while (true) {
    const value = (await rl.question('Category (poetry / prose / fragment): ')).trim().toLowerCase();
    if (categories.has(value)) return value;
    output.write('poetry, prose, fragment 중 하나를 입력해 주세요.\n');
  }
}

async function askDraft() {
  while (true) {
    const value = (await rl.question('Draft? (Y/n): ')).trim().toLowerCase();
    if (!value || value === 'y' || value === 'yes') return true;
    if (value === 'n' || value === 'no') return false;
    output.write('y 또는 n으로 입력해 주세요. 기본값은 y입니다.\n');
  }
}

try {
  const title = await askRequired('Title: ');
  const { slug, path } = await askSlug();
  const writtenAt = await askWrittenAt();
  const category = await askCategory();
  const tags = (await rl.question('Tags (comma-separated, optional): '))
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const draft = await askDraft();

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    ...(writtenAt ? [`writtenAt: ${writtenAt}`] : []),
    `publishedAt: ${today()}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    `category: ${category}`,
    `draft: ${draft}`,
    '---',
    '',
    '<!-- 여기에 원문을 입력하세요. -->',
    '',
  ].join('\n');

  await mkdir(writingsDirectory, { recursive: true });
  await writeFile(path, frontmatter, { encoding: 'utf8', flag: 'wx' });
  output.write(`생성 완료: src/content/writings/${slug}.md\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}
