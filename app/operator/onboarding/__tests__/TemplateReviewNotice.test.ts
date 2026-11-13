import React from 'react';
import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {TemplateReviewNotice,isTemplateReviewBlocked} from '../TemplateReviewNotice';
it('distinguishes reviewed-template unavailability from ordinary transport or role errors',()=>{for(const reason of ['platform_review_required','platform_template_unavailable'])expect(isTemplateReviewBlocked(reason)).toBe(true);for(const reason of ['network_error','broker_assume_role_perms_missing',undefined])expect(isTemplateReviewBlocked(reason)).toBe(false)});
it('explains the operator decision without offering IAM expansion, deployment or an unchanged retry loop',()=>{const html=renderToStaticMarkup(React.createElement(TemplateReviewNotice));expect(html).toContain('platform operator');expect(html).toContain('independent review');expect(html).toContain('unavailable');expect(html).toContain('href="/docs"');expect(html).not.toMatch(/<button|Create policy|Copy policy|Start a fresh|sts:AssumeRole|Try again/)});
