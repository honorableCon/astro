import { expect } from 'chai';
import cheerio from 'cheerio';
import { loadFixture } from './test-utils.js';

let fixture;

describe('Tailwind', () => {
	let fixture;
	let devServer;

    before(async () => {
		fixture = await loadFixture({
			projectRoot: './fixtures/tailwindcss/',
			renderers: [],
			vite: {
				build: {
					assetsInlineLimit: 0,
				},
			},
		});
	});

    // test HTML and CSS contents for accuracy
    describe('build', () => {
		let $;
		let bundledCSS;

        before(async () => {
			await fixture.build();

			// get bundled CSS (will be hashed, hence DOM query)
			const html = await fixture.readFile('/index.html');
			$ = cheerio.load(html);
			const bundledCSSHREF = $('link[rel=stylesheet][href^=/assets/]').attr('href');
			bundledCSS = await fixture.readFile(bundledCSSHREF.replace(/^\/?/, '/'));
		});

        it('includes used component classes', async () => {
            expect(bundledCSS).to.match(/\.bg-purple-600{/);
        });

        it('purges unused classes', async () => {
            // tests a random tailwind class that isn't used on the page
            expect(bundledCSS).not.to.match(/\.bg-blue-600{/);
        });

        it('includes responsive classes', async () => {
            // tailwind escapes colons, `lg:py-3` compiles to `lg\:py-3`
            expect(bundledCSS).to.match(/\.lg\\:py-3{/)
        })

        it('supports arbitrary value classes', async () => {
            // tailwind escapes brackets, `font-[900]` compiles to `font-\[900\]`
            expect(bundledCSS).to.match(/\.font-\\\[900\\\]{font-weight:900}/)
        })
    });

    // with "build" handling CSS checking, the dev tests are mostly testing the paths resolve in dev
    describe('dev', () => {
        let devServer;
		let $;

		before(async () => {
			devServer = await fixture.startDevServer();
			const html = await fixture.fetch('/').then((res) => res.text());
			$ = cheerio.load(html);
		});

		after(async () => {
			devServer && (await devServer.stop());
		});

		it('resolves CSS in src/styles', async () => {
			const href = $(`link[href$="/src/styles/global.css"]`).attr('href');
            const res = await fixture.fetch(href);
            expect(res.status).to.equal(200);

            const text = await res.text()
            
            expect(text, 'includes used component classes').to.match(/\.bg-purple-600/);
            expect(text, 'purges unused classes').not.to.match(/\.bg-blue-600/);
            expect(text, 'includes responsive classes').to.match(/\.lg\\\\:py-3/);
            expect(text, 'supports arbitrary value classes').to.match(/.font-\\[900\\]/)
		});
    })
});