//////////////////////////////////////////////////////////////////////////////
// Utility Functions
/////////////////////////////////////////////////////////////////////////////

function randI(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

Array.prototype.shuffle = function() {
  let i = this.length, j, temp;
  if (i == 0) return this;
  while ( --i ) {
     j = Math.floor(Math.random() * (i + 1));
     temp = this[i];
     this[i] = this[j];
     this[j] = temp;
  }
  return this;
}

function Swappable(createFunc) {
	this.front = createFunc();
	this.back = createFunc();
}
Swappable.prototype.swap = function() {
	const tmp = this.back;
	this.back = this.front;
	this.front = tmp;
}

function swap(front, back) {
	const tmp = back;
	back = front;
	front = tmp;
}

