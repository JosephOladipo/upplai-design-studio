import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import {
  mockPlan,
  createDesignPlan
} from '../src/ai-design-director.mjs';

import {
  validatePlan,
  safeImagePrompt,
  compositions
} from '../src/ai-plan.mjs';

import {
  generateVisual
} from '../src/openai-image.mjs';

import {
  readConfig,
  qualityMap
} from '../src/ai-config.cjs';


const input = {
  headline: 'Your next career step',
  supportingCopy: 'Exact copy.\nNo rewrites.',
  cta: 'Learn more',
  customDirection: '',
  visualStyle: 'auto',
  composition: 'auto'
};

const config = readConfig({
  OPENAI_MOCK_MODE: 'true'
});


test('Mock Mode is enabled and quality defaults are correct', () => {
  assert.equal(config.mockMode, true);
  assert.equal(config.quality, 'low');

  assert.deepEqual(qualityMap, {
    draft: 'low',
    standard: 'medium',
    premium: 'high'
  });
});


test('Invalid configuration is rejected', () => {
  const badMock = readConfig({
    OPENAI_MOCK_MODE: 'TRUE'
  });

  assert.ok(badMock.error);

  const badQuality = readConfig({
    OPENAI_MOCK_MODE: 'true',
    OPENAI_IMAGE_QUALITY: 'ultra'
  });

  assert.ok(badQuality.error);
});


test('Mock Design Director returns valid plans', () => {
  for (const composition of compositions) {
    const plan = mockPlan({
      ...input,
      composition
    });

    assert.equal(plan.composition, composition);
    assert.equal(plan.safeTextArea, composition);

    validatePlan(plan);
  }
});


test('Invalid design plans are rejected', () => {
  const plan = mockPlan(input);

  assert.throws(() => {
    validatePlan({
      ...plan,
      headline: 'This field must not exist'
    });
  });

  assert.throws(() => {
    validatePlan({
      ...plan,
      fontStyle: 'remote-font'
    });
  });

  assert.throws(() => {
    validatePlan({
      ...plan,
      safeTextArea: 'right'
    });
  });
});


test('Safe image prompt forbids generated text and logos', () => {
  const plan = mockPlan(input);
  const prompt = safeImagePrompt(plan);

  assert.match(prompt, /NO headline/i);
  assert.match(prompt, /logo/i);
  assert.match(prompt, /watermark/i);
});


test('Mock pipeline does not require OpenAI network access', async () => {
  const client = new Proxy({}, {
    get() {
      throw new Error('Network attempted in Mock Mode');
    }
  });

  const plan = await createDesignPlan({
    config,
    input,
    client
  });

  validatePlan(plan);

  const result = await generateVisual({
    config,
    plan,
    quality: 'draft',
    client
  });

  assert.match(
    result.image,
    /^data:image\/svg\+xml;base64,/
  );
});


test('Design Director Responses contract preserves exact input', async () => {
  let request;

  const client = {
    responses: {
      create: async value => {
        request = value;

        return {
          status: 'completed',
          output_text: JSON.stringify(mockPlan(input))
        };
      }
    }
  };

  await createDesignPlan({
    config: {
      ...config,
      mockMode: false
    },
    input,
    client
  });

  assert.equal(
    request.text.format.type,
    'json_schema'
  );

  assert.equal(
    request.text.format.strict,
    true
  );

  assert.equal(
    request.store,
    false
  );

  assert.deepEqual(
    JSON.parse(request.input),
    input
  );
});


test('Incomplete Design Director response is rejected', async () => {
  const client = {
    responses: {
      create: async () => ({
        status: 'incomplete'
      })
    }
  };

  await assert.rejects(
    createDesignPlan({
      config: {
        ...config,
        mockMode: false
      },
      input,
      client
    })
  );
});


test('Malformed Design Director plan is rejected', async () => {
  const client = {
    responses: {
      create: async () => ({
        status: 'completed',
        output_text: '{}'
      })
    }
  };

  await assert.rejects(
    createDesignPlan({
      config: {
        ...config,
        mockMode: false
      },
      input,
      client
    })
  );
});


test('Image generation uses one image and correct quality mapping', async () => {
  for (const quality of Object.keys(qualityMap)) {
    let request;

    const pngHeader = Buffer.from([
      137, 80, 78, 71,
      13, 10, 26, 10
    ]);

    const client = {
      images: {
        generate: async value => {
          request = value;

          return {
            data: [{
              b64_json: pngHeader.toString('base64')
            }]
          };
        }
      }
    };

    await generateVisual({
      config: {
        ...config,
        mockMode: false
      },
      plan: mockPlan(input),
      quality,
      client
    });

    assert.equal(request.n, 1);
    assert.equal(
      request.quality,
      qualityMap[quality]
    );

    assert.equal(
      request.size,
      '1024x1536'
    );

    assert.equal(
      request.output_format,
      'png'
    );
  }
});


test('Malformed image-generation response is rejected', async () => {
  const client = {
    images: {
      generate: async () => ({
        data: []
      })
    }
  };

  await assert.rejects(
    generateVisual({
      config: {
        ...config,
        mockMode: false
      },
      plan: mockPlan(input),
      quality: 'draft',
      client
    })
  );
});


test('Local Phase 7 API works entirely in Mock Mode', async () => {
  process.env.OPENAI_MOCK_MODE = 'true';

  const require = createRequire(import.meta.url);
  const app = require('../server.js');

  const server = app.listen(
    0,
    '127.0.0.1'
  );

  await new Promise(resolve => {
    server.once('listening', resolve);
  });

  const root =
    'http://127.0.0.1:' +
    server.address().port;

  const post = (path, body) =>
    fetch(root + '/api/ai/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

  try {
    const healthResponse =
      await fetch(root + '/api/health');

    assert.equal(
      healthResponse.status,
      200
    );

    const health =
      await healthResponse.json();

    assert.equal(
      health.status,
      'ok'
    );


    const statusResponse =
      await fetch(root + '/api/ai/status');

    assert.equal(
      statusResponse.status,
      200
    );

    const status =
      await statusResponse.json();

    assert.equal(
      status.mockMode,
      true
    );

    assert.equal(
      'apiKey' in status,
      false
    );


    const privateConfig =
      await fetch(
        root + '/src/ai-config.cjs'
      );

    assert.equal(
      privateConfig.status,
      404
    );


    const privateDirector =
      await fetch(
        root +
        '/src/ai-design-director.mjs'
      );

    assert.equal(
      privateDirector.status,
      404
    );


    const invalidPlanResponse =
      await post(
        'design-plan',
        {
          ...input,
          headline: 'a'.repeat(181)
        }
      );

    assert.equal(
      invalidPlanResponse.status,
      400
    );


    const planResponse =
      await post(
        'design-plan',
        input
      );

    assert.equal(
      planResponse.status,
      200
    );

    const planned =
      await planResponse.json();

    validatePlan(
      planned.plan
    );

    const explicitSubjectResponse =
      await post(
        'design-plan',
        { ...input, subjectType: 'none' }
      );

    assert.equal(
      explicitSubjectResponse.status,
      200
    );

    const explicitSubject =
      await explicitSubjectResponse.json();

    assert.equal(
      explicitSubject.plan.subjectType,
      'none'
    );

    const invalidSubjectResponse =
      await post(
        'design-plan',
        { ...input, subjectType: 'not-supported' }
      );

    assert.equal(
      invalidSubjectResponse.status,
      400
    );


    const brandedPlanResponse =
      await post(
        'design-plan',
        {
          ...input,
          subjectType: 'none',
          brandContext: {
            brandName: 'Route Brand',
            colors: { primary: '#112233', secondary: '#223344', accent: '#334455', dark: '#445566', light: '#EEDDCC' },
            fonts: { heading: 'Georgia', body: 'Arial' },
            logos: { primary: 'data:image/png;base64,not-sent' }
          }
        }
      );

    assert.equal(brandedPlanResponse.status, 200);
    const brandedPlan = await brandedPlanResponse.json();
    assert.equal(brandedPlan.plan.subjectType, 'none');
    assert.match(brandedPlan.plan.imagePrompt, /#112233/);
    assert.doesNotMatch(brandedPlan.plan.imagePrompt, /data:image|base64/i);

    const invalidBrandResponse =
      await post(
        'design-plan',
        { ...input, brandContext: { brandName: 'Bad', colors: {}, fonts: {} } }
      );

    assert.equal(invalidBrandResponse.status, 400);

    const visualResponse =
      await post(
        'generate-visual',
        {
          planId: planned.planId,
          quality: 'draft'
        }
      );

    assert.equal(
      visualResponse.status,
      200
    );

    const visual =
      await visualResponse.json();

    assert.equal(
      visual.mockMode,
      true
    );

    assert.match(
      visual.image,
      /^data:image/
    );


    const missingPlan =
      await post(
        'generate-visual',
        {
          planId: 'missing',
          quality: 'draft'
        }
      );

    assert.equal(
      missingPlan.status,
      400
    );


    const invalidQuality =
      await post(
        'generate-visual',
        {
          planId: planned.planId,
          quality: 'invalid'
        }
      );

    assert.equal(
      invalidQuality.status,
      400
    );


    const blockedOrigin =
      await fetch(
        root +
        '/api/ai/design-plan',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            Origin:
              'https://example.com'
          },

          body:
            JSON.stringify(input)
        }
      );

    assert.equal(
      blockedOrigin.status,
      403
    );

  } finally {

    await new Promise(resolve => {
      server.close(resolve);
    });

  }
});
import { normalizeBrandContext, brandVisualDirection } from '../src/ai-brand.mjs';
import { activeBrandContext, directorInput } from '../src/ai-style.js';

const brandContext = {
  brandName: 'Northstar Studio',
  colors: { primary: '#112233', secondary: '#223344', accent: '#334455', dark: '#445566', light: '#EEDDCC' },
  fonts: { heading: 'Georgia', body: 'Arial' }
};

test('Brand Kit context is normalized for AI planning without logo data', () => {
  const normalized = normalizeBrandContext({ ...brandContext, logos: { primary: 'data:image/png;base64,secret' } });
  assert.deepEqual(normalized, brandContext);
  assert.match(brandVisualDirection(normalized), /#112233/);
  assert.equal(normalizeBrandContext({ ...brandContext, colors: { ...brandContext.colors, primary: 'red' } }), null);
});

test('Mock Design Director applies safe brand palette direction while explicit controls win', () => {
  const plan = mockPlan({ ...input, brandContext, visualStyle: 'futuristic', subjectType: 'none', composition: 'right', customDirection: 'Keep a quiet, cinematic technology mood.' });
  assert.equal(plan.imageStyle, 'futuristic');
  assert.equal(plan.subjectType, 'none');
  assert.equal(plan.composition, 'right');
  assert.match(plan.visualConcept, /cinematic technology mood/);
  assert.match(plan.imagePrompt, /#112233/);
  assert.doesNotMatch(plan.imagePrompt, /data:image|base64/i);
  assert.match(safeImagePrompt(plan), /NO headline/i);
  assert.match(safeImagePrompt(plan), /logo/i);
});

test('Create Design uses the same text-only runtime brand context for OpenAI planning', () => {
  const request = directorInput({ headline: 'Headline', supportingCopy: 'Copy', cta: 'CTA', aiVisualStyle: 'editorial', aiSubject: 'none', aiComposition: 'right', aiDirection: '', aiQuality: 'draft' });
  assert.deepEqual(request.brandContext, activeBrandContext());
  assert.equal(request.subjectType, 'none');
  assert.equal(request.visualStyle, 'editorial');
  assert.equal(request.composition, 'right');
  assert.equal('logos' in request.brandContext, false);
});

