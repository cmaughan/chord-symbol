import _uniq from 'lodash/uniq';

import chain from '../../helpers/chain';

import m from '../../dictionaries/modifiers';
import { allSymbols, allVariants } from '../../dictionaries/modifiers';
import intervalsToSemitones from '../../dictionaries/intervalsToSemitones';
import { hasNoneOf, hasOneOf } from '../../helpers/hasElement';


/**
 * @param {Chord} chord
 * @returns {Chord|Null}
 */
export default function parseDescriptor(chord) {
	let allModifiers = [];

	if (chord.input.descriptor) {
		chord.input.parsableDescriptor = getParsableDescriptor(chord.input.descriptor);

		allModifiers = getModifiers(chord.input.parsableDescriptor);

		if (!allModifiers) return null;
	}

	chord.normalized.intervals = getIntervals(allModifiers);
	chord.normalized.semitones = getSemitones(chord.normalized.intervals);
	chord.normalized.intents = getIntents(allModifiers);

	return chord;
}

function getModifiers(parsableDescriptor) {
	const modifiers = [];

	const descriptorRegex = new RegExp(allVariants.map(escapeRegex).join('|'), 'g');
	const descriptorMatches = parsableDescriptor.match(descriptorRegex);

	let remainingChars = parsableDescriptor;
	let modifierId;

	if (descriptorMatches) {
		descriptorMatches.forEach(match => {
			modifierId = allSymbols[match];
			if (modifiers.includes(modifierId)) {
				return null;
			}
			modifiers.push(modifierId);

			remainingChars = remainingChars.replace(match, '');
		});
	}

	if (modifiers.length === 0 || remainingChars.trim().length > 0) {
		return null;
	}
	return modifiers;
}

function getParsableDescriptor(descriptor) {
	const allFilters = [
		toLowerCaseExceptMajorM,
		removeSpaces,
		addDisambiguators,
		addMissingVerbs,
	];

	return chain(allFilters, descriptor);
}

function toLowerCaseExceptMajorM(descriptor) {
	return descriptor
		.replace(/[A-LN-Za-z]+/g, match => match.toLowerCase())
		.replace('oMit', 'omit')
		.replace('diM', 'dim')
		.replace('augMented', 'augmented');
}

function removeSpaces(descriptor) {
	return descriptor.replace(/ /g, '');
}

function addDisambiguators(descriptor) {
	return descriptor
		.replace(/(7?dim)add/g, '$1 add')
		.replace(/([m|M])add/g, '$1 add')
		.replace(/i(no[35])/g, 'i $1')
		.replace(/([b♭#♯]9)6/g, '$1 6')
		.replace(/(9\/?6)/g, ' $1');
}

function addMissingVerbs(descriptor) {
	let allTokensWithVerbs;
	let currentVerb;
	let hasVerb;

	return descriptor.replace(/\((.*?)\)/g, (match, parenthesis) => {
		allTokensWithVerbs = [];
		currentVerb = '';

		parenthesis
			.split(',')
			.forEach(token => {
				hasVerb = true;
				if (token.startsWith('add')) {
					currentVerb = 'add';
				} else if (token.startsWith('omit')) {
					currentVerb = 'omit';
				} else if (token.startsWith('no')) {
					currentVerb = 'no';
				} else {
					hasVerb = false;
				}
				if (hasVerb) {
					allTokensWithVerbs.push(token);
				} else {
					allTokensWithVerbs.push(currentVerb + token);
				}
			});
		return ' ' + allTokensWithVerbs.join(' ') + ' ';
	});
}

function getIntervals(allModifiers) {
	if (allModifiers.includes(m.power)) {
		return ['1', '5'];

	} else if (allModifiers.includes(m.bass)) {
		return ['1'];
	}

	return _uniq([
		'1',
		...getThird(allModifiers),
		...getFourth(allModifiers),
		...getFifths(allModifiers),
		...getSixth(allModifiers),
		...getSevenths(allModifiers),
		...getNinths(allModifiers),
		...getElevenths(allModifiers),
		...getThirteenths(allModifiers),
	])
		.sort((a, b) => (intervalsToSemitones[a] - intervalsToSemitones[b]));
}

function getThird(allModifiers) {
	const third = [];
	if (allModifiers.includes(m.omit3)) {
		return [];
	}
	if (!hasOneOf(allModifiers, [m.sus, m.sus2])) {
		if (!hasMajorIntent(allModifiers)) {
			third.push('b3');
		} else if (!allModifiers.includes(m.eleventh)) {
			third.push('3');
		}
	}
	if (allModifiers.includes(m.add3)) {
		third.push('3');
	}
	return third;
}

function getFourth(allModifiers) {
	const fourth = [];
	if (hasOneOf(allModifiers, [m.sus, m.add4])) {
		fourth.push('4');
	}
	return fourth;
}

function getFifths(allModifiers) {
	const fifths = [];
	if (allModifiers.includes(m.omit5)) {
		return [];
	}
	if (hasOneOf(allModifiers, [m.dim, m.halfDim, m.fifthFlat])) {
		fifths.push('b5');
	}
	if (hasOneOf(allModifiers, [m.aug, m.fifthSharp])) {
		fifths.push('#5');
	}
	if (!fifths.length && !allModifiers.includes(m.thirteenthFlat)) {
		fifths.push('5');
	}
	return fifths;
}

function getSixth(allModifiers) {
	const sixth = [];
	if (hasOneOf(allModifiers, [m.add6, m.add69]) && !isExtended(allModifiers)) {
		sixth.push('6');
	}
	return sixth;
}

function getSevenths(allModifiers) {
	const sevenths = [];
	if (hasOneOf(allModifiers, [m.seventh, m.halfDim])) {
		if (allModifiers.includes(m.dim)) {
			sevenths.push('bb7');

		} else if (allModifiers.includes(m.halfDim)) {
			sevenths.push('b7');

		} else {
			sevenths.push(getMinorOrMajorSeventh(allModifiers));
		}

	} else if (hasOneOf(allModifiers, [m.ninth, m.eleventh, m.thirteenth])) {
		sevenths.push(getMinorOrMajorSeventh(allModifiers));
	}

	if (allModifiers.includes(m.add7)) {
		sevenths.push('7');
	}
	return sevenths;
}

function getMinorOrMajorSeventh(allModifiers) {
	return (allModifiers.includes(m.ma)) ? '7' : 'b7';
}

function getNinths(allModifiers) {
	const ninth = [];
	if (
		hasOneOf(allModifiers, [m.add69, m.ninth, m.eleventh, m.thirteenth])
		&& hasNoneOf(allModifiers, [m.ninthFlat, m.ninthSharp])
	) {
		ninth.push('9');
	}
	if (hasOneOf(allModifiers, [m.sus2, m.add9])) {
		ninth.push('9');
	}
	if (allModifiers.includes(m.ninthFlat)) {
		ninth.push('b9');
	}
	if (allModifiers.includes(m.ninthSharp)) {
		ninth.push('#9');
	}
	return ninth;
}

function getElevenths(allModifiers) {
	const elevenths = [];
	if (hasOneOf(allModifiers, [m.thirteenth]) && !hasMajorIntent(allModifiers)) {
		elevenths.push('11');

	} else if (hasOneOf(allModifiers, [m.eleventh, m.add11])) {
		elevenths.push('11');
	}
	if (allModifiers.includes(m.eleventhSharp)) {
		elevenths.push('#11');
	}
	return elevenths;
}

function getThirteenths(allModifiers) {
	const thirteenths = [];
	if (
		hasOneOf(allModifiers, [m.add13, m.thirteenth])
		|| (hasOneOf(allModifiers, [m.add6, m.add69]) && isExtended(allModifiers))
	) {
		thirteenths.push('13');
	}
	if (allModifiers.includes(m.thirteenthFlat)) {
		thirteenths.push('b13');
	}
	return thirteenths;
}

function hasMajorIntent(allModifiers) {
	return hasNoneOf(allModifiers, [m.mi, m.dim, m.dim7, m.halfDim]);
}

function isExtended(allModifiers) {
	return hasOneOf(allModifiers, [m.seventh, m.ninth, m.eleventh, m.thirteenth]);
}

// Based on https://stackoverflow.com/a/6969486
function escapeRegex(string) {
	return string.replace(/[.\-*+?^${}()|[\]\\]/g, '\\$&');
}

function getSemitones(allIntervals) {
	return allIntervals
		.map(interval => intervalsToSemitones[interval])
		.sort((a, b) => (a - b));
}

// intents will be used later at formatting for disambiguation of some potentially confusing cases
function getIntents(allModifiers) {
	return {
		major: hasMajorIntent(allModifiers),
		eleventh: allModifiers.includes(m.eleventh),
	};
}

