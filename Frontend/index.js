/**
 * @format
 */

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { sha256 } from '@noble/hashes/sha256';

// Supabase PKCE uses WebCrypto (crypto.subtle.digest). React Native doesn't ship it by default.
// Provide a minimal SHA-256 digest polyfill so PKCE can use S256 (avoids falling back to "plain").
if (!global.crypto) {
	global.crypto = {};
}

if (!global.crypto.subtle) {
	global.crypto.subtle = {
		digest: async (algorithm, data) => {
			const algoName =
				typeof algorithm === 'string'
					? algorithm
					: algorithm && typeof algorithm === 'object'
						? String(algorithm.name || '')
						: '';

			if (algoName.toUpperCase() !== 'SHA-256') {
				throw new Error(`Unsupported digest algorithm: ${algoName || 'unknown'}`);
			}

			const bytes =
				data instanceof ArrayBuffer
					? new Uint8Array(data)
					: ArrayBuffer.isView(data)
						? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
						: new Uint8Array(data);

			const hash = sha256(bytes);
			return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
		},
	};
}

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
