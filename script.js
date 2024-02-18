'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10); // create id from current date in ms
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
     'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration); // calls the constructor of the parent class
    this.cadence = cadence;
    this.calcPace();
    this._setDescription(); // will be called when a new object is created
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration); // calls the constructor of the parent class
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription(); // will be called when a new object is created
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE
// DOM elements
const form = document.querySelector('.form');
const list = document.querySelector('.workouts__list');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllWorkoutsBtn = document.querySelector('.workout__delete-all');

const sortType = document.querySelector('.workout__sort-type');
let sortTypeDirection = true;
const sortDistance = document.querySelector('.workout__sort-distance');
let sortDistanceDirection = true;
const sortDuration = document.querySelector('.workout__sort-duration');
let sortDurationDirection = true;

/**
 * Represents an application for managing workouts.
 * @class
 */
class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #editingWorkoutId;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this)); // needs to be bound since it will use the form element as this
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    deleteAllWorkoutsBtn.addEventListener('click', this._deleteAllWorkouts.bind(this));

    sortType.addEventListener('click', this._sortType.bind(this));
    sortDistance.addEventListener('click', this._sortDistance.bind(this));
    sortDuration.addEventListener('click', this._sortDuration.bind(this));
    // Add event listener to the parent of the workouts
    document.querySelector('.workouts').addEventListener('click', e => {
      const btn = e.target.closest('.workout__delete');
      if (!btn) return; // If the clicked element is not the delete button, do nothing

      const workoutId = btn.closest('.workout').dataset.id;
      this._deleteWorkout(workoutId);
    });

    // Add event listener to the parent of the workouts
    document.querySelector('.workouts').addEventListener('click', e => {
      const btn = e.target.closest('.workout__edit');
      if (btn) {
        const workoutId = btn.closest('.workout').dataset.id;
        this._editWorkout(workoutId);
      }
    });
  }

  _getPosition(position) {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), function () {
        alert('Could not get your position');
      });
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Render markers
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(e) {
    this.#mapEvent = e;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // If a workout is being edited, update it instead of creating a new one
    if (this.#editingWorkoutId) {
      const workout = this.#workouts.find(workout => workout.id === this.#editingWorkoutId);
      workout.distance = Number(inputDistance.value);
      workout.duration = Number(inputDuration.value);
      if (workout.type === 'running') {
        workout.cadence = Number(inputCadence.value);
      }
      if (workout.type === 'cycling') {
        workout.elevationGain = Number(inputElevation.value);
      }

      let newWorkout;
      if (inputType.value !== workout.type) {
        switch (inputType.value) {
          case 'running':
            newWorkout = new Running(workout.coords, workout.distance, workout.duration, +inputCadence.value);
            break;
          case 'cycling':
            newWorkout = new Cycling(workout.coords, workout.distance, workout.duration, +inputElevation.value);
            break;
          default:
            break;
        }

        this.#workouts.splice(workout, 1, newWorkout);
      }

      // Clear the form
      inputDistance.value = '';
      inputDuration.value = '';
      if (workout.type === 'running') {
        inputCadence.value = '';
      } else {
        inputElevation.value = '';
      }

      // Clear the id of the workout being edited
      this.#editingWorkoutId = null;

      this._renderWorkout(workout);

      this._hideForm();

      this._setLocalStorage();

      location.reload();

      return;
    }

    const type = inputType.value;
    const distance = +inputDistance.value; // convert to number
    const duration = +inputDuration.value; // convert to number
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    if (type === 'running') {
      const cadence = +inputCadence.value; // convert to number
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence))
        return alert('Inputs have to be positive numbers!');
      workout = new Running([lat, lng], distance, duration, cadence);
    }
    if (type === 'cycling') {
      const elevation = +inputElevation.value; // convert to number
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration))
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this.#workouts.push(workout);
    console.log(workout);

    this._renderWorkoutMarker(workout);

    this._renderWorkout(workout);

    this._hideForm();

    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️ ' : '🚴‍♀️ '} - ${workout.description}`)
      .openPopup();
  }

  /**
   * Renders a workout item in the HTML.
   * @param {Object} workout - The workout object to be rendered.
   */
  _renderWorkout(workout) {
    // console.log(workout);
    let html = `<li class="workout workout--${workout.type}" data-id="${workout.id}">
     <h2 class="workout__title">${workout.description}</h2>
     <div class="workout__details">
       <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️ ' : '🚴‍♀️ '}</span>
       <span class="workout__value">${workout.distance}</span>
       <span class="workout__unit">km</span>
     </div>
     <div class="workout__details">
       <span class="workout__icon">⏱</span>
       <span class="workout__value">${workout.duration}</span>
       <span class="workout__unit">min</span>
     </div>`;

    if (workout.type === 'running')
      html += `<div class="workout__details">
       <span class="workout__icon">⚡️</span>
       <span class="workout__value">${workout.pace.toFixed(1)}</span>
       <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
       <span class="workout__icon">🦶🏼</span>
       <span class="workout__value">${workout.cadence}</span>
       <span class="workout__unit">spm</span>
      </div>`;

    if (workout.type === 'cycling')
      html += `<div class="workout__details">
       <span class="workout__icon">⚡️</span>
       <span class="workout__value">${workout.speed.toFixed(1)}</span>
       <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
       <span class="workout__icon">⛰</span>
       <span class="workout__value">${workout.elevationGain}</span>
       <span class="workout__unit">m</span>
      </div>`;

    html += `<div class="workout__controls">
              <button class="btn workout__delete">Delete</button>
              <button class="btn workout__edit">Edit</button>
             </div></li>`;
    list.insertAdjacentHTML('afterbegin', html);
  }

  #clearLiElements() {
    // Assuming `ul` is your unordered list element
    let children = Array.from(list.children); // Get all children of the ul

    children.forEach(child => {
      // If the child is not the form and is an li, remove it
      if (child.tagName.toLowerCase() === 'li') {
        list.removeChild(child);
      }
    });
  }

  /**
   * Moves to the popup associated with the clicked workout element.
   *
   * @param {Event} e - The event object.
   */
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout'); // closest parent element with class workout

    if (!workoutEl) return; // guard clause

    const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // using the public interface
    workout.click();
  }

  /**
   * Sets the workouts data in the local storage.
   */
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts)); // local storage can only store strings
  }

  /**
   * Retrieves data from local storage and initializes workouts.
   * @private
   */
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts')); // parse the string back to an object

    if (!data) return;

    // initialize workouts from local storage
    this.#workouts = data.map(work => {
      work.type === 'running' ? (work.__proto__ = Running.prototype) : (work.__proto__ = Cycling.prototype);

      return work;
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  // TODO: ability to edit workouts
  _editWorkout(id) {
    // Find the workout with the given id
    console.log(id);
    const editingWorkout = this.#workouts.find(workout => workout.id === id);
    console.log(editingWorkout);
    console.log(this.#workouts);
    if (!editingWorkout) return;

    this._showForm();

    // Fill in the form with the workout's data
    inputType.value = editingWorkout.type;
    inputDistance.value = editingWorkout.distance;
    inputDuration.value = editingWorkout.duration;

    inputCadence.closest('.form__row').classList.remove('form__row--hidden');
    inputElevation.closest('.form__row').classList.remove('form__row--hidden');

    if (editingWorkout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.value = editingWorkout.cadence;
    } else {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = editingWorkout.elevationGain;
    }

    // Save the id of the workout being edited
    this.#editingWorkoutId = editingWorkout.id;
  }

  // TODO: ability to delete all workouts
  _deleteAllWorkouts() {
    this.#workouts = [];
    this._setLocalStorage();
    location.reload();
  }

  /**
   * Deletes a workout from the list of workouts.
   * @param {Object} workout - The workout object to be deleted.
   */
  _deleteWorkout(workout) {
    const index = this.#workouts.indexOf(workout);
    this.#workouts.splice(index, 1);
    this._setLocalStorage();
    location.reload();
  }

  // _sortType() {
  //   let activitiesCopy = this.#workouts.slice();
  //   activitiesCopy.sort(function (a, b) {
  //     return a.type.localeCompare(b.type);
  //   });
  //   this.#clearLiElements();
  //   activitiesCopy.forEach(work => {
  //     this._renderWorkout(work);
  //   });
  // }

  // _sortDistance() {
  //   let activitiesCopy = this.#workouts.slice();
  //   activitiesCopy.sort(function (a, b) {
  //     return a.distance - b.distance;
  //   });
  //   console.log(this.#workouts);
  //   console.log(activitiesCopy);
  //   this.#clearLiElements();
  //   activitiesCopy.forEach(work => {
  //     this._renderWorkout(work);
  //   });
  // }
  _sortType() {
    let activitiesCopy = this.#workouts.slice();
    if (!sortTypeDirection) {
      activitiesCopy.sort(function (a, b) {
        return a.type.localeCompare(b.type);
      });
    } else {
      activitiesCopy.sort(function (a, b) {
        return b.type.localeCompare(a.type);
      });
    }
    sortTypeDirection = !sortTypeDirection;
    this.#clearLiElements();
    activitiesCopy.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _sortDuration() {
    let activitiesCopy = this.#workouts.slice();
    if (!sortDurationDirection) {
      activitiesCopy.sort(function (a, b) {
        return b.duration - a.duration;
      });
    } else {
      activitiesCopy.sort(function (a, b) {
        return a.duration - b.duration;
      });
    }
    sortDurationDirection = !sortDurationDirection;
    this.#clearLiElements();
    activitiesCopy.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _sortDistance() {
    let activitiesCopy = this.#workouts.slice();
    if (!sortDistanceDirection) {
      activitiesCopy.sort(function (a, b) {
        return b.distance - a.distance;
      });
    } else {
      activitiesCopy.sort(function (a, b) {
        return a.distance - b.distance;
      });
    }
    sortDistanceDirection = !sortDistanceDirection;
    this.#clearLiElements();
    activitiesCopy.forEach(work => {
      this._renderWorkout(work);
    });
  }
}

const app = new App();

// TODO: ability to sort workouts by a certain field (e.g. distance)
// TODO: ability to re-build Running and Cycling objects without the constructor
// TODO: More realistic error and confirmation messages

// BONUS:
// TODO: ability to position the map to show all workouts
// TODO: ability to draw lines and shapes instead of just points

// EXTRA CHALLENGES (Async coding likely needed):
// TODO: Geocode location from coordinates ("Run in Faro, Portugal")
// TODO: ability to display the weather data for workout time and place
