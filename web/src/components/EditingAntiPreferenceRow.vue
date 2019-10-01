<template>
    <tr>
        <td>
            <div class="input-group">
                <input
                    class="form-control"
                    v-bind:value="usernameA"
                    v-on:input="$emit('input-username-a', $event.target.value)"
                />
                <div class="input-group-append">
                    <span class="input-group-text">@chadwickschool.org</span>
                </div>
            </div>
        </td>
        <td>
            <div class="input-group">
                <input
                    class="form-control"
                    v-bind:value="usernameB"
                    v-on:input="$emit('input-username-b', $event.target.value)"
                />
                <div class="input-group-append">
                    <span class="input-group-text">@chadwickschool.org</span>
                </div>
            </div>
        </td>
        <td>
            <button class="btn btn-primary" v-on:click="$emit('click-save')">Save</button>
        </td>
    </tr>
</template>

<script>
export default {
    name: 'EditingAntiPreferenceRow',
    props: ['usernameA', 'usernameB'],
}
</script>
