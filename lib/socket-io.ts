// Stemmed from https://stackoverflow.com/a/28288406/2864502

import {Server} from 'socket.io';

const io = new Server();

io.on('connection', (socket) => {
	console.log('Socket connected');

	socket.on('disconnect', () => {
		console.log('Socket disconnected');
	});
});

export default io;
