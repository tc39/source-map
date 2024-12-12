/**
 * Some notes:
 * - Prince cant grok trailing commas, so prettier is disabled anywhere it tries to enforce wrapping with trailing
 * comma
 * - Prince doesn't support template strings yet
 * - Set Prince.trackboxes to true for advanced debugging, see
 * https://www.princexml.com/doc/cookbook/#how-and-where-is-my-box
 * */

/* eslint-disable no-undef */
'use strict';

// Prince.trackBoxes = true;

const specContainer = document.getElementById('spec-container');

PDF.pageLayout = 'two-column-right';
PDF.pageMode = 'show-bookmarks';
PDF.duplex = 'duplex-flip-long-edge';
PDF.title = document.title;
PDF.author = 'Ecma International';
PDF.subject = 'ECMA-XXX, 2024';


Prince.registerPostLayoutFunc(() => {
  specContainer.parentNode.insertBefore(generateFrontCover(), specContainer);
  specContainer.parentNode.insertBefore(generateInsideCover(), specContainer);
});

function generateFrontCover() {
  const shortname = document.createElement('h1');
  const version = document.createElement('h1')
  const title = document.createElement('h1');
  const year = "2024";

  shortname.innerHTML = 'Draft Standard ECMA-XXX';
  version.innerHTML = "December, 2024";
  title.innerHTML = 'Source Map Format Specification';
  
  shortname.classList.add('shortname');
  title.classList.add('title');
  version.classList.add('version');

  version.setAttribute('data-year', year);

  const frontCover = document.createElement('div');
  shortname.innerHTML = shortname.innerHTML.replace(/standard/i, '');
  // eslint-disable-next-line prettier/prettier
  shortname.innerHTML = shortname.innerHTML.replace(/(draft|proposal)/i, '<span class="status">$1</span>');
  version.innerHTML = "ECMA-XXX, 2024";
  title.innerHTML = title.innerHTML.replace(/(®|&reg;)/, '<sup>&reg;</sup>');

  frontCover.classList.add('full-page-svg');
  frontCover.setAttribute('id', 'front-cover');

  frontCover.appendChild(shortname);
  frontCover.appendChild(version);
  frontCover.appendChild(title);

  return frontCover;
}

function generateInsideCover() {
  const insideCover = document.createElement('div');

  insideCover.classList.add('full-page-svg');
  insideCover.setAttribute('id', 'inside-cover');
  insideCover.innerHTML =
    '<p>Ecma International<br />Rue du Rhone 114 CH-1204 Geneva<br/>Tel: +41 22 849 6000<br/>Fax: +41 22 849 6001<br/>Web: https://www.ecma-international.org<br/>Ecma is the registered trademark of Ecma International.</p>';

  return insideCover;
}


/**
 * @typedef {Object} PrinceBox
 * @property {string} type
 * @property {number} pageNum
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} baseline
 * @property {number} marginTop
 * @property {number} marginBottom
 * @property {number} marginLeft
 * @property {number} marginRight
 * @property {number} paddingTop
 * @property {number} paddingBottom
 * @property {number} paddingLeft
 * @property {number} paddingRight
 * @property {number} borderTop
 * @property {number} borderBottom
 * @property {number} borderLeft
 * @property {number} borderRight
 * @property {string} floatPosition "TOP" or "BOTTOM"
 * @property {PrinceBox[]} children
 * @property {PrinceBox} parent
 * @property {Element|null} element
 * @property {string|null} pseudo
 * @property {string} text
 * @property {string} src
 * @property {CSSStyleSheet} style
 * */
